#!/usr/bin/env node
/**
 * Patches `global-client/dist/client-config.js` in place, pointing its PUBHUBS_URL/PHC_URL at the
 * `networkhost.ip` configured in `pubhubs/pubhubs.toml` (see scripts/lib/resolve-networkhost-ip.js) instead
 * of `localhost`. PubHubs Central hands out hub/MSS URLs built from that same alias, so the global client
 * needs to request it too — otherwise it never even attempts the address that's been made reachable.
 *
 * This only matters for real-device testing: `localhost` resolves to the dev machine in the iOS Simulator
 * (shared network), but resolves to the device itself on a real device, where nothing is listening.
 *
 * `global-client/dist/client-config.js` is a gitignored build artifact — freshly overwritten from the
 * tracked `global-client/public/client-config.js` on every `npm run build:global:native` (Vite re-copies
 * `public/*` into `dist/` on every build, regardless of `emptyOutDir`) — so patching it in place here is
 * safe: there's no tracked source to keep clean, no second script tag needed in index.html, and no runtime
 * platform check needed either, since this script only ever runs as part of the iOS build chain (`npm run
 * cap:sync:ios` / `cap:run:ios`, see package.json) — Android's own chain never calls it, relying instead on
 * `adb reverse` to tunnel `localhost` back to the dev machine on real devices (see docs/app/README.md).
 *
 * Must run after `npm run build:global:native` and before `npx cap sync ios` / `cap run ios` / `cap copy
 * ios`, so the LAN IP is baked in before Capacitor copies `dist/` into the native project.
 *
 * See docs/app/README.md and pubhubs/src/servers/config/host_aliases.rs for background.
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
