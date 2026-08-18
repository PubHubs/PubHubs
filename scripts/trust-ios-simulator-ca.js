#!/usr/bin/env node
/**
 * Trusts the local `mkcert` dev CA (see scripts/gen-dev-proxy.js) inside every currently *booted* iOS
 * Simulator, via `xcrun simctl keychain <udid> add-root-cert`. The Simulator has its own keychain, which
 * `mkcert -install` doesn't reach, and there's no hook to catch "a new Simulator just booted", so this
 * is an explicit step to rerun per Simulator instance. See docs/app/README.md.
 *
 * No-ops (with a message, not an error) on non-macOS or when Xcode/`xcrun` isn't installed, so it's safe
 * to call from any platform's dev flow.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

function hasXcrun() {
	try {
		execFileSync('xcrun', ['--version'], { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

function bootedSimulators() {
	const json = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], { encoding: 'utf8' });
	const { devices } = JSON.parse(json);
	return Object.values(devices).flat();
}

function mkcertCaRoot() {
	return execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim();
}

function main() {
	if (!hasXcrun()) {
		console.log('trust-ios-simulator-ca: no Xcode/xcrun found (not on macOS, or Xcode not installed) — nothing to do.');
		return;
	}

	// Best-effort from here on: this is a convenience step wired into `cap:run:ios`/`cap:open:ios`
	// (see package.json), and must never fail that chain — a developer testing on a real device, or
	// who'll fix Simulator cert trust separately, shouldn't be blocked by a problem here.
	let caRoot;
	try {
		caRoot = mkcertCaRoot();
	} catch (err) {
		console.error(`trust-ios-simulator-ca: 'mkcert' is not installed or not on PATH — see docs/app/README.md. (${err.message})`);
		return;
	}
	const rootCertPath = path.join(caRoot, 'rootCA.pem');

	const simulators = bootedSimulators();
	if (simulators.length === 0) {
		console.log('trust-ios-simulator-ca: no booted iOS Simulator found — boot one, then re-run this (e.g. `npm run trust:ios-simulator`).');
		return;
	}

	for (const sim of simulators) {
		console.log(`trust-ios-simulator-ca: trusting the dev CA in "${sim.name}" (${sim.udid})...`);
		try {
			execFileSync('xcrun', ['simctl', 'keychain', sim.udid, 'add-root-cert', rootCertPath], { stdio: 'inherit' });
		} catch (err) {
			console.error(`trust-ios-simulator-ca: failed for "${sim.name}" (${sim.udid}): ${err.message}`);
		}
	}
}

main();
