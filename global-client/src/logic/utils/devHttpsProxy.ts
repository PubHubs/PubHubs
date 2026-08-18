// Packages
import { Capacitor } from '@capacitor/core';

/**
 * Maps a hub's plain-HTTP dev address onto the local HTTPS dev proxy that `mask run proxy` runs.
 *
 * The native shell serves global-client from `https://pubhubs-app.invalid` (`androidScheme: 'https'`
 * in capacitor.config.ts), while PHC hands out hub addresses built from the plain-HTTP `networkhost`
 * ports in pubhubs.toml. Fetching those over XHR merely needs the WebView's relaxed mixed-content
 * mode, but a passive subresource — the hub icons and banner in `models/Hubs.ts` — is auto-upgraded
 * to https by Chromium with the port kept as-is, so it lands on the plain-HTTP Synapse port and the
 * handshake fails. No WebSettings mixed-content knob covers that, hence this rewrite: point at the
 * HTTPS front instead and there is no mixed content left to upgrade.
 *
 * Dev-only by construction. It fires only inside the native shell, and only for plain-HTTP addresses
 * on the exact ports the proxy fronts, so web dev and production (where PHC hands out real https
 * URLs) are untouched. See docs/app/README.md.
 */

// Both must match scripts/gen-dev-proxy.js, which generates the Caddyfile these ports come from.
const PORT_OFFSET = 10000;
const FRONTED_PORT_BASES = [8001, 8008];
const NUM_TESTHUBS = 5;

const frontedPorts = FRONTED_PORT_BASES.flatMap((base) => Array.from({ length: NUM_TESTHUBS }, (_, n) => base + n));

const toDevHttpsProxyUrl = (url: string): string => {
	if (!Capacitor.isNativePlatform()) return url;

	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return url;
	}

	// An unfronted port would be rewritten onto a Caddy address that isn't listening, turning a
	// working plain-HTTP hub into a connection error, so leave anything unrecognised alone.
	if (parsed.protocol !== 'http:' || !frontedPorts.includes(Number(parsed.port))) return url;

	parsed.protocol = 'https:';
	parsed.port = String(Number(parsed.port) + PORT_OFFSET);

	return parsed.toString();
};

export { toDevHttpsProxyUrl };
