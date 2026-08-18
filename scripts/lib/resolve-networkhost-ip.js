/**
 * Resolves the `networkhost` IP used for real-device dev testing, from `pubhubs/pubhubs.toml`'s
 * `[host_aliases] networkhost.ip` (or the `networkhost.source_ip_for` auto-detect fallback).
 *
 * Shared by scripts/sync-networkhost-ip.js, scripts/patch-ios-client-config-ip.js, and
 * scripts/gen-dev-proxy.js — see docs/app/README.md.
 */

import dgram from 'node:dgram';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { parse as parseToml } from 'smol-toml';
import path from 'node:path';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PUBHUBS_TOML = path.join(REPO_ROOT, 'pubhubs', 'pubhubs.toml');
const PUBHUBS_DEFAULT_TOML = path.join(REPO_ROOT, 'pubhubs', 'pubhubs.default.toml');

const AUTO_DETECT_TIMEOUT_MS = 3000;

/**
 * Mirrors the auto-detect trick in `HostAliases::resolve_all()`
 * (pubhubs/src/servers/config/host_aliases.rs): "connecting" a UDP socket to a remote host:port never
 * sends a packet, but makes the OS pick a route, letting us read back the local address it'd use.
 *
 * We resolve the hostname via `dns.lookup()` ourselves first, since on a failed lookup `dgram`'s connect
 * callback fires anyway bound to "0.0.0.0" instead of emitting 'error' — we guard against that case.
 */
function autoDetectSourceIp(sourceIpFor) {
	return new Promise((resolve, reject) => {
		let target;
		try {
			target = new URL(sourceIpFor);
		} catch (err) {
			reject(new Error(`Could not parse networkhost.source_ip_for "${sourceIpFor}": ${err.message}`));
			return;
		}

		const timer = setTimeout(() => {
			reject(new Error(`Timed out auto-detecting local IP via ${sourceIpFor}`));
		}, AUTO_DETECT_TIMEOUT_MS);
		const settle = (fn, arg) => {
			clearTimeout(timer);
			fn(arg);
		};

		dns.lookup(target.hostname, (lookupErr, remoteAddress) => {
			if (lookupErr) {
				settle(reject, new Error(`Could not resolve ${target.hostname}: ${lookupErr.message}`));
				return;
			}

			const socket = dgram.createSocket('udp4');
			socket.on('error', (err) => {
				socket.close();
				settle(reject, err);
			});

			socket.connect(Number(target.port), remoteAddress, () => {
				const { address } = socket.address();
				socket.close();

				if (address === '0.0.0.0') {
					settle(reject, new Error(`Could not determine a local route to ${remoteAddress}:${target.port}`));
					return;
				}

				settle(resolve, address);
			});
		});
	});
}

/**
 * Returns the current `networkhost` IP, or `null` if neither is configured.
 * Throws if auto-detection is configured but fails.
 */
export async function resolveNetworkhostIp() {
	const configPath = fs.existsSync(PUBHUBS_TOML) ? PUBHUBS_TOML : PUBHUBS_DEFAULT_TOML;
	const config = parseToml(fs.readFileSync(configPath, 'utf8'));
	const networkhost = config?.host_aliases?.networkhost;

	if (typeof networkhost?.ip === 'string' && networkhost.ip.length > 0) {
		return networkhost.ip;
	}

	if (typeof networkhost?.source_ip_for === 'string' && networkhost.source_ip_for.length > 0) {
		return await autoDetectSourceIp(networkhost.source_ip_for);
	}

	return null;
}
