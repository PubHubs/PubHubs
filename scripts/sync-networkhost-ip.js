#!/usr/bin/env node
/**
 * Generates `ios/App/App/Info.plist` (gitignored) from `Info.template.plist` (tracked) with the ATS
 * exception domain filled in, and keeps `capacitor.config.local.json`'s `networkhostIp` in sync — both
 * from the `networkhost.ip` configured in `pubhubs/pubhubs.toml`, or `pubhubs.default.toml` if that
 * doesn't exist yet. Both are needed for real-device testing: PHC hands out hub/MSS URLs built from that
 * alias, and Android's WebView applies the same allowNavigation host-matching to iframe navigation, so
 * without the LAN IP the hub-client iframe gets bounced out of the app. See docs/app/README.md.
 *
 * Generating Info.plist from a template (rather than patching it in place) keeps it out of git: the
 * per-machine IP never shows up as a tracked change, the same way `patch-ios-client-config-ip.js` below
 * only ever touches a gitignored build artifact.
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

const INFO_PLIST_TEMPLATE = path.join(REPO_ROOT, 'ios', 'App', 'App', 'Info.template.plist');
const INFO_PLIST = path.join(REPO_ROOT, 'ios', 'App', 'App', 'Info.plist');
const CAPACITOR_CONFIG_LOCAL = path.join(REPO_ROOT, 'capacitor.config.local.json');

const NETWORKHOST_IP_PLACEHOLDER = '__NETWORKHOST_IP__';
// Used only when no networkhost.ip/source_ip_for is configured yet, so Info.plist still exists and
// Xcode can build. Never actually reached over the network — real-device testing needs a real IP.
const FALLBACK_IP = '127.0.0.1';

function generateInfoPlist(ip) {
	const template = fs.readFileSync(INFO_PLIST_TEMPLATE, 'utf8');
	const placeholderKey = `<key>${NETWORKHOST_IP_PLACEHOLDER}</key>`;

	if (!template.includes(placeholderKey)) {
		console.error(`sync-networkhost-ip: expected to find ${placeholderKey} in ${path.relative(REPO_ROOT, INFO_PLIST_TEMPLATE)}, but it's missing.`);
		console.error('The template structure may have changed — please update it by hand instead of guessing. See docs/app/README.md.');
		process.exitCode = 1;
		return;
	}

	const generated = template.replace(placeholderKey, `<key>${ip}</key>`);
	if (fs.existsSync(INFO_PLIST) && fs.readFileSync(INFO_PLIST, 'utf8') === generated) {
		console.log(`sync-networkhost-ip: Info.plist already in sync (${ip}).`);
		return;
	}

	fs.writeFileSync(INFO_PLIST, generated);
	console.log(`sync-networkhost-ip: generated Info.plist with ATS exception for ${ip}`);
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
	let ip = null;
	try {
		ip = await resolveNetworkhostIp();
	} catch (err) {
		console.warn(`sync-networkhost-ip: could not auto-detect networkhost IP (${err.message}) — leaving capacitor.config.local.json unchanged.`);
		console.warn('Set an explicit networkhost.ip in pubhubs/pubhubs.toml if this keeps happening.');
	}

	if (!ip) {
		console.warn(
			`sync-networkhost-ip: neither networkhost.ip nor networkhost.source_ip_for set in pubhubs/pubhubs.toml (or pubhubs.default.toml) — falling back to ${FALLBACK_IP} for Info.plist and leaving capacitor.config.local.json unchanged.`,
		);
	}

	// Info.plist must exist for Xcode to build at all, so always (re)generate it, even with the
	// fallback IP — unlike capacitor.config.local.json, which is fine left absent/stale.
	generateInfoPlist(ip ?? FALLBACK_IP);

	if (ip) {
		syncCapacitorConfigLocal(ip);
	}
}

main();
