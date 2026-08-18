#!/usr/bin/env node
/**
 * Keeps `ios/App/App/Info.plist`'s ATS exception domain, and `capacitor.config.local.json`'s
 * `networkhostIp`, in sync with the `networkhost.ip` configured in `pubhubs/pubhubs.toml`, or
 * `pubhubs.default.toml` if that doesn't exist yet. Both are needed for real-device testing: PHC hands
 * out hub/MSS URLs built from that alias, and Android's WebView applies the same allowNavigation
 * host-matching to iframe navigation, so without the LAN IP the hub-client iframe gets bounced out of
 * the app. See docs/app/README.md.
 *
 * The other half — global-client's own PUBHUBS_URL/PHC_URL — is handled instead by
 * `scripts/patch-ios-client-config-ip.js` (see that script for why).
 *
 * Wired into `npm run cap:sync:ios` / `cap:run:ios` / `cap:open:ios` (see package.json), so this never
 * needs to be run by hand.
 */
import { REPO_ROOT, resolveNetworkhostIp } from './lib/resolve-networkhost-ip.js';
import fs from 'node:fs';
import path from 'node:path';

const INFO_PLIST = path.join(REPO_ROOT, 'ios', 'App', 'App', 'Info.plist');
const CAPACITOR_CONFIG_LOCAL = path.join(REPO_ROOT, 'capacitor.config.local.json');

const IPV4_KEY_RE = /<key>(\d{1,3}(?:\.\d{1,3}){3})<\/key>/g;

function syncInfoPlist(ip) {
	const plist = fs.readFileSync(INFO_PLIST, 'utf8');
	const matches = [...plist.matchAll(IPV4_KEY_RE)];

	if (matches.length !== 1) {
		console.error(
			`sync-networkhost-ip: expected exactly one IPv4 <key> entry in ${path.relative(REPO_ROOT, INFO_PLIST)}'s NSExceptionDomains, found ${matches.length}.`,
		);
		console.error('The plist structure may have changed — please update it by hand instead of guessing. See docs/app/README.md.');
		process.exitCode = 1;
		return;
	}

	const currentIp = matches[0][1];
	if (currentIp === ip) {
		console.log(`sync-networkhost-ip: already in sync (${ip}).`);
		return;
	}

	const updated = plist.replace(`<key>${currentIp}</key>`, `<key>${ip}</key>`);
	fs.writeFileSync(INFO_PLIST, updated);
	console.log(`sync-networkhost-ip: updated Info.plist ATS exception ${currentIp} → ${ip}`);
}

function syncCapacitorConfigLocal(ip) {
	const content = JSON.stringify({ networkhostIp: ip }, null, '\t') + '\n';
	if (fs.existsSync(CAPACITOR_CONFIG_LOCAL) && fs.readFileSync(CAPACITOR_CONFIG_LOCAL, 'utf8') === content) {
		console.log(`sync-networkhost-ip: capacitor.config.local.json already in sync (${ip}).`);
		return;
	}

	fs.writeFileSync(CAPACITOR_CONFIG_LOCAL, content);
	console.log(`sync-networkhost-ip: updated capacitor.config.local.json to use ${ip}`);
}

async function main() {
	let ip;
	try {
		ip = await resolveNetworkhostIp();
	} catch (err) {
		console.warn(
			`sync-networkhost-ip: could not auto-detect networkhost IP (${err.message}) — leaving Info.plist and capacitor.config.local.json unchanged.`,
		);
		console.warn('Set an explicit networkhost.ip in pubhubs/pubhubs.toml if this keeps happening.');
		return;
	}

	if (!ip) {
		console.warn(
			'sync-networkhost-ip: neither networkhost.ip nor networkhost.source_ip_for set in pubhubs/pubhubs.toml (or pubhubs.default.toml) — leaving Info.plist and capacitor.config.local.json unchanged.',
		);
		return;
	}

	syncInfoPlist(ip);
	syncCapacitorConfigLocal(ip);
}

main();
