#!/usr/bin/env node
/**
 * Patches `global-client/dist/client-config.js` in place, pointing its PUBHUBS_URL/PHC_URL at the
 * `networkhost.ip` from `pubhubs/pubhubs.toml` (see scripts/lib/resolve-networkhost-ip.js) instead of
 * `localhost` — needed for real-device testing, since PHC hands out hub/MSS URLs built from that same
 * alias and a real device has no route to `localhost` on the dev machine. See docs/app/README.md.
 *
 * `dist/client-config.js` is a gitignored build artifact, freshly overwritten from the tracked
 * `global-client/public/client-config.js` on every `npm run build:global:native`, so patching it in place
 * is safe — nothing tracked stays dirty. This only runs as part of the iOS build chain (`npm run
 * cap:sync:ios` / `cap:run:ios`), while Android relies on `adb reverse` instead.
 *
 * Must run after `npm run build:global:native` and before `npx cap sync ios` / `cap run ios` /
 * `cap copy ios`, so the LAN IP is baked in before Capacitor copies `dist/` into the native project.
 */
import { REPO_ROOT, resolveNetworkhostIp } from './lib/resolve-networkhost-ip.js';
import fs from 'node:fs';
import path from 'node:path';

const CLIENT_CONFIG_DIST = path.join(REPO_ROOT, 'global-client', 'dist', 'client-config.js');

const LOCALHOST_URL_RE = /(\w+):\s*'http:\/\/localhost:(\d+)'/g;

function patchClientConfig(ip) {
	if (!fs.existsSync(CLIENT_CONFIG_DIST)) {
		console.error(`patch-ios-client-config-ip: ${path.relative(REPO_ROOT, CLIENT_CONFIG_DIST)} does not exist — run \`npm run build:global:native\` first.`);
		process.exitCode = 1;
		return;
	}

	const config = fs.readFileSync(CLIENT_CONFIG_DIST, 'utf8');
	const keyPorts = [...config.matchAll(LOCALHOST_URL_RE)];

	if (keyPorts.length === 0) {
		console.error(`patch-ios-client-config-ip: found no '<KEY>: 'http://localhost:<port>'' entries in ${path.relative(REPO_ROOT, CLIENT_CONFIG_DIST)}.`);
		console.error('The file structure may have changed — please update it by hand instead of guessing. See docs/app/README.md.');
		process.exitCode = 1;
		return;
	}

	let updated = config;
	for (const [match, key, port] of keyPorts) {
		updated = updated.replace(match, `${key}: 'http://${ip}:${port}'`);
	}

	fs.writeFileSync(CLIENT_CONFIG_DIST, updated);
	console.log(`patch-ios-client-config-ip: patched ${path.relative(REPO_ROOT, CLIENT_CONFIG_DIST)} to use ${ip}`);
}

async function main() {
	let ip;
	try {
		ip = await resolveNetworkhostIp();
	} catch (err) {
		console.warn(`patch-ios-client-config-ip: could not auto-detect networkhost IP (${err.message}) — leaving ${path.relative(REPO_ROOT, CLIENT_CONFIG_DIST)} unchanged.`);
		console.warn('Set an explicit networkhost.ip in pubhubs/pubhubs.toml if this keeps happening.');
		return;
	}

	if (!ip) {
		console.warn(
			`patch-ios-client-config-ip: neither networkhost.ip nor networkhost.source_ip_for set in pubhubs/pubhubs.toml (or pubhubs.default.toml) — leaving ${path.relative(REPO_ROOT, CLIENT_CONFIG_DIST)} unchanged.`,
		);
		return;
	}

	patchClientConfig(ip);
}

main();
