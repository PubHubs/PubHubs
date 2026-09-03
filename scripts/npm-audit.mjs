#!/usr/bin/env node
// Fails on `npm audit` advisories that our policy does not accept: the npm counterpart of
// `cargo deny check advisories` on the Rust side.  `npm audit` itself can only filter on severity
// (`--audit-level`), which is all or nothing per level, so this script does the filtering: it reads
// the report, drops the advisories listed in npm-audit.config.mjs (each with a reason, optionally
// with an expiry date) and fails on whatever is left.
//
// Run it with `npm run check:audit` or `mask check audit`; CI runs it in the `npm-audit` job.
// Everything it needs is in package-lock.json, so it works without node_modules installed.
// We will want to replace this with better-npm-audit if that package ever comes alive again. (No updates for 2 years currently).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// npm's severity levels, weakest first.  `info` exists in the report format but npm no longer
// assigns it; we keep it so a threshold of 'info' still means "fail on anything".
const SEVERITIES = ['info', 'low', 'moderate', 'high', 'critical'];
const IGNORE_KEYS = ['id', 'reason', 'expires'];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = 'npm-audit.config.mjs';

const today = new Date().toISOString().slice(0, 10);

// How to run npm, worked out once by `npmInvocation`.
let npm;

/**
 * The npm to run: an absolute path, plus the arguments that come before ours.
 *
 * Never plain `'npm'`, which would leave it to PATH which npm a run picks up.
 */
const npmInvocation = () => {
	if (npm) return npm;

	// `npm run` and npx both set npm_execpath to the absolute path of the npm-cli.js they are running,
	// so this branch runs exactly the npm that called us -- on Windows as well.
	const execpath = process.env.npm_execpath;
	if (execpath && existsSync(execpath)) {
		npm = { command: process.execPath, leadingArguments: [execpath] };
		return npm;
	}

	// Started directly (`node scripts/npm-audit.mjs`): npm sits next to the node binary running us in
	// every layout we use, the node:26 CI image and the Nix dev shell included.
	const sibling = path.join(path.dirname(process.execPath), 'npm');
	if (existsSync(sibling)) {
		npm = { command: sibling, leadingArguments: [] };
		return npm;
	}

	throw new Error(`Found no npm next to ${process.execPath}; please run this through \`npm run check:audit\`.`);
};

/** Runs `npm audit --json` in the repository root and returns the parsed report. */
const runAudit = (extraArguments = []) => {
	const { command, leadingArguments } = npmInvocation();
	let stdout;
	try {
		stdout = execFileSync(command, [...leadingArguments, 'audit', '--json', ...extraArguments], {
			cwd: ROOT,
			encoding: 'utf8',
			// execFileSync passes the child's stderr straight through to ours unless we capture it
			// ourselves, and npm's warnings would then land in the middle of our own report.
			stdio: ['ignore', 'pipe', 'pipe'],
			// A tree this size produces a report of a few hundred kilobytes; the default 1 MiB buffer
			// is uncomfortably close to that.
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch (error) {
		// npm exits non-zero as soon as it finds a single vulnerability, so a non-zero exit only means
		// something actually went wrong when there is no report on stdout to read.
		stdout = error.stdout ?? '';
		if (!stdout.trim()) {
			throw new Error(`\`npm audit\` failed:\n${error.stderr || error.message}`);
		}
	}

	let report;
	try {
		report = JSON.parse(stdout);
	} catch {
		throw new Error(`\`npm audit\` did not return JSON:\n${stdout.slice(0, 1000)}`);
	}

	// npm reports registry problems (no network, an unreachable advisory endpoint) inside the JSON.
	// Treating that as "no advisories found" would silently turn this check off.
	if (report.error) {
		// The `error` object is often empty, with the actual problem (an unreachable registry, say) in
		// `message` next to it.
		throw new Error(
			`\`npm audit\` reported an error: ${[report.message, report.error.summary, report.error.detail].filter(Boolean).join('\n') || JSON.stringify(report.error)}`,
		);
	}
	if (report.auditReportVersion !== 2) {
		throw new Error(`Unexpected audit report version ${report.auditReportVersion}; this script only understands version 2.`);
	}

	return report;
};

/** The identifier an advisory is ignored by: its GHSA id, or npm's own numeric id if it has no GHSA. */
const advisoryId = (via) => /GHSA-[0-9a-z-]+/i.exec(via.url ?? '')?.[0] ?? `npm-${via.source}`;

// The dependency tree, read once and only when an advisory needs it.  `undefined` means "not read
// yet", `null` that reading it failed.
let tree;

/**
 * The tree `npm ls` builds from package-lock.json.
 *
 * The audit report says which package is vulnerable but not how it got into the tree, and that is the
 * part a reader can act on: the vulnerable package is usually one nobody here has heard of, while its
 * dependency chain ends at something we chose ourselves.  `--package-lock-only` keeps this working
 * without node_modules, and makes the chains match the lockfile that was audited.
 */
const dependencyTree = () => {
	if (tree !== undefined) return tree;

	try {
		const { command, leadingArguments } = npmInvocation();
		let stdout;
		try {
			stdout = execFileSync(command, [...leadingArguments, 'ls', '--all', '--json', '--package-lock-only'], {
				cwd: ROOT,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				maxBuffer: 64 * 1024 * 1024,
			});
		} catch (error) {
			// Without node_modules npm reports every package as missing and exits non-zero, but the
			// tree it prints is the one from the lockfile and is all we need.
			stdout = error.stdout ?? '';
		}
		tree = JSON.parse(stdout);
	} catch {
		tree = null;
	}

	return tree;
};

/** The dependency chains from one of our own dependencies down to `name`, shortest first. */
const chainsTo = (name) => {
	const root = dependencyTree();
	if (!root) return [];

	const chains = [];
	const walk = (node, trail) => {
		for (const [child, childNode] of Object.entries(node.dependencies ?? {})) {
			// npm prints a package it has already described elsewhere in the tree without its own
			// dependencies, so a trail cannot revisit a name and cannot become circular.
			if (trail.includes(child)) continue;
			// Every line we print a chain under already names the vulnerable package, so the chain
			// stops at the dependency that asks for it.
			if (child === name) chains.push(trail);
			else walk(childNode, [...trail, child]);
		}
	};

	walk(root, []);
	return chains.sort((a, b) => a.length - b.length);
};

/** Every advisory in the report, keyed by id.  npm lists an advisory once per affected package. */
const collectAdvisories = (report) => {
	const advisories = new Map();

	for (const entry of Object.values(report.vulnerabilities)) {
		for (const via of entry.via) {
			// A string means "vulnerable because of that other package"; the advisory itself is an
			// object, and it appears in the entry of the package it applies to.
			if (typeof via !== 'object') continue;

			const id = advisoryId(via);
			if (advisories.has(id)) continue;

			advisories.set(id, {
				id,
				severity: via.severity,
				package: via.name,
				vulnerableRange: via.range,
				title: via.title,
				url: via.url,
				chains: chainsTo(via.name),
				// npm sets this to `true` for "a matching version exists", or to the package it would
				// have to change (with `isSemVerMajor`) when the fix is not a drop-in one.
				fixAvailable: entry.fixAvailable,
			});
		}
	}

	return advisories;
};

/**
 * The ids of the advisories that survive `--omit=dev`, i.e. that reach the code we ship.
 *
 * Only a hint, not a guarantee: a build-time dependency such as vite-plugin-node-polyfills can still
 * put code from its own dependency tree into the client bundle, and a compromised dev dependency runs
 * on developer and CI machines.  Returns `null` when npm cannot produce the second report, so the
 * check keeps working without it.
 */
const productionAdvisoryIds = () => {
	try {
		const ids = new Set();
		for (const entry of Object.values(runAudit(['--omit=dev']).vulnerabilities)) {
			for (const via of entry.via) {
				if (typeof via === 'object') ids.add(advisoryId(via));
			}
		}
		return ids;
	} catch {
		return null;
	}
};

/** Reads npm-audit.config.mjs and rejects anything the rest of this script would silently ignore. */
const loadConfig = async () => {
	const configPath = path.join(ROOT, CONFIG_FILE);
	const config = (await import(pathToFileURL(configPath))).default;
	const problems = [];

	if (typeof config !== 'object' || config === null || Array.isArray(config)) {
		throw new Error(`${CONFIG_FILE} must default-export an object.`);
	}

	for (const key of Object.keys(config)) {
		if (!['failOn', 'ignore'].includes(key)) problems.push(`unknown option \`${key}\``);
	}
	if (!SEVERITIES.includes(config.failOn)) {
		problems.push(`\`failOn\` must be one of ${SEVERITIES.join(', ')}, got ${JSON.stringify(config.failOn)}`);
	}
	if (!Array.isArray(config.ignore)) {
		problems.push('`ignore` must be an array');
	}

	for (const entry of Array.isArray(config.ignore) ? config.ignore : []) {
		const where = `ignore entry ${JSON.stringify(entry?.id ?? entry)}`;

		for (const key of Object.keys(entry ?? {})) {
			if (!IGNORE_KEYS.includes(key)) problems.push(`${where}: unknown key \`${key}\` (expected ${IGNORE_KEYS.join(', ')})`);
		}
		if (typeof entry?.id !== 'string' || !entry.id) problems.push(`${where}: \`id\` must be the advisory id as printed by this check`);
		// A reason is the point of the file: an entry without one is impossible to review later.
		if (typeof entry?.reason !== 'string' || entry.reason.trim().length < 10)
			problems.push(`${where}: \`reason\` must explain why this advisory is acceptable`);
		if (entry?.expires !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires)) problems.push(`${where}: \`expires\` must be a YYYY-MM-DD date`);
	}

	const ids = (Array.isArray(config.ignore) ? config.ignore : []).map((entry) => entry?.id);
	const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
	if (duplicates.length > 0) problems.push(`duplicate ignore entries for ${[...new Set(duplicates)].join(', ')}`);

	if (problems.length > 0) {
		const list = problems.map((problem) => `  - ${problem}`).join('\n');
		throw new Error(`${CONFIG_FILE} is invalid:\n${list}`);
	}

	return config;
};

/** Describes what npm says about upgrading away from an advisory. */
const describeFix = (fixAvailable) => {
	if (fixAvailable === true) return 'a fixed version is available: try `npm update` on the packages above, or `npm audit fix`';
	if (!fixAvailable) return 'npm knows no version to upgrade to';
	const major = fixAvailable.isSemVerMajor ? ' (a major version change)' : '';
	return `npm would fix this by moving to ${fixAvailable.name}@${fixAvailable.version}${major}`;
};

/** How an advisory relates to the code we ship, as the phrase printed under it. */
const describeReach = (productionIds, id) => {
	if (productionIds === null) return 'reachability through devDependencies unknown';
	if (productionIds.has(id)) return 'reaches the dependencies we ship';
	return 'reached through devDependencies only';
};

const formatAdvisory = (advisory, reach, notes = []) => {
	// One or two chains are enough to see who to talk to about an upgrade; the rest are usually the
	// same dependency reached through a handful of its siblings.
	const shown = advisory.chains.slice(0, 2).map((chain) => `pulled in by ${chain.join(' > ')}`);
	const rest = advisory.chains.length > 2 ? [`... and ${advisory.chains.length - 2} more dependency chains`] : [];
	const details = [
		advisory.title,
		// Advisories without a GHSA page (npm's own, or one from a private registry) have no url.
		...(advisory.url ? [advisory.url] : []),
		...shown,
		...rest,
		`${reach}, ${describeFix(advisory.fixAvailable)}`,
		...notes,
	];

	const heading = `  ${advisory.severity.padEnd(8)} ${advisory.package} ${advisory.vulnerableRange}`;
	return [heading, ...details.map((detail) => `           ${detail}`)].join('\n');
};

const main = async () => {
	const config = await loadConfig();
	const advisories = collectAdvisories(runAudit());
	const productionIds = productionAdvisoryIds();
	const ignores = new Map(config.ignore.map((entry) => [entry.id, entry]));

	const failing = [];
	const belowThreshold = [];
	const ignored = [];

	for (const advisory of [...advisories.values()].sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity))) {
		const ignore = ignores.get(advisory.id);
		const expired = ignore?.expires !== undefined && ignore.expires < today;
		const reach = describeReach(productionIds, advisory.id);

		if (ignore && !expired) {
			ignored.push(
				formatAdvisory(advisory, reach, [`ignored: ${ignore.reason}`, ...(ignore.expires ? [`this exception expires on ${ignore.expires}`] : [])]),
			);
		} else if (expired) {
			// An expiry that has passed is the whole point of the field: the exception stops working
			// and the advisory has to be fixed or consciously re-approved.
			failing.push(
				formatAdvisory(advisory, reach, [
					`its exception in ${CONFIG_FILE} expired on ${ignore.expires}: fix the advisory or re-approve it with a new date`,
				]),
			);
		} else if (SEVERITIES.indexOf(advisory.severity) < SEVERITIES.indexOf(config.failOn)) {
			belowThreshold.push(formatAdvisory(advisory, reach));
		} else {
			failing.push(formatAdvisory(advisory, reach));
		}
	}

	const unused = config.ignore.filter((entry) => !advisories.has(entry.id));

	console.log(`npm audit policy (${CONFIG_FILE}): fail on ${config.failOn} and above, with ${config.ignore.length} ignore entries.\n`);

	if (failing.length > 0) console.log(`Not accepted by the policy:\n${failing.join('\n')}\n`);
	if (belowThreshold.length > 0) console.log(`Below the \`failOn\` threshold, not failing this job:\n${belowThreshold.join('\n')}\n`);
	if (ignored.length > 0) console.log(`Ignored by the policy:\n${ignored.join('\n')}\n`);
	if (unused.length > 0) {
		// Not a failure: an advisory can disappear because someone else updated a dependency, and that
		// should not turn their pipeline red.  Saying so keeps the file from collecting dead entries.
		const list = unused.map((entry) => `  ${entry.id} (${entry.reason})`).join('\n');
		console.log(`No longer needed in ${CONFIG_FILE}, please remove:\n${list}\n`);
	}

	console.log(`${advisories.size} advisories: ${failing.length} not accepted, ${ignored.length} ignored, ${belowThreshold.length} below the threshold.`);

	if (failing.length > 0) {
		console.log(
			`\nFix them (\`npm update <package>\`, \`npm audit fix\`, or a version bump in package.json), or -- if the advisory does not apply to the way we use the package -- add it to ${CONFIG_FILE} with a reason.`,
		);
		process.exitCode = 1;
	}
};

try {
	await main();
} catch (error) {
	// A broken config or an audit we could not run is not "no vulnerabilities found": exit 2 so it is
	// distinguishable from a policy failure.
	console.error(error.message);
	process.exitCode = 2;
}
