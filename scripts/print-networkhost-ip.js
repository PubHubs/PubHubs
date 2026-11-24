#!/usr/bin/env node
/**
 * Prints the current `networkhost` IP (see scripts/lib/resolve-networkhost-ip.js) to stdout, for use in
 * shell command substitution — e.g. maskfile.md's "hub client (n)" task, which needs it to build
 * VITE_HUB_URL.
 */

import { resolveNetworkhostIp } from './lib/resolve-networkhost-ip.js';

const ip = await resolveNetworkhostIp();
if (!ip) {
	console.error('print-networkhost-ip: neither networkhost.ip nor networkhost.source_ip_for set in pubhubs/pubhubs.toml (or pubhubs.default.toml).');
	process.exit(1);
}
console.log(ip);
