#!/usr/bin/env node
/**
 * Prints the current `networkhost` IP (see scripts/lib/resolve-networkhost-ip.js) to stdout, for use in
 * shell command substitution — e.g. maskfile.md's "hub client (n)" task, which needs the same IP the
 * HTTPS dev proxy (`mask run proxy`, see scripts/gen-dev-proxy.js) is fronted on.
 */

import { resolveNetworkhostIp } from './lib/resolve-networkhost-ip.js';

const ip = await resolveNetworkhostIp();
if (!ip) {
	console.error('print-networkhost-ip: neither networkhost.ip nor networkhost.source_ip_for set in pubhubs/pubhubs.toml (or pubhubs.default.toml).');
	process.exit(1);
}
console.log(ip);
