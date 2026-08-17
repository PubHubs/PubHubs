import { type CapacitorConfig } from '@capacitor/cli';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A hostname the app owns exclusively. WebViewLocalServer (Android) / WKURLSchemeHandler (iOS) intercept
 * requests to this (scheme, host) pair locally, regardless of whether it resolves in real DNS — and since
 * '.invalid' is reserved by RFC 2606 to never be delegated as a real, resolvable TLD, no ordinary browser
 * or web page — on any device, in any deployment — can ever be served under this origin. This is what
 * makes hub-client's NATIVE_SHELL_ORIGINS check (hub-client/src/stores/messagebox.ts) safe to trust
 * unconditionally: unlike the previous 'localhost' (a generic hostname any locally-running process/dev
 * server can occupy), nothing else can ever produce this origin.
 *
 * If you change this value, also update hub-client/src/stores/messagebox.ts's NATIVE_SHELL_ORIGINS to
 * match — see the security note there.
 */
const NATIVE_SHELL_APP_HOSTNAME = 'pubhubs-app.invalid';

/**
 * Dev-only extra host the WebView may navigate to, on top of 'localhost' (iOS Simulator, Android via `adb
 * reverse`, generic dev convenience). Android needs this for the hub-client iframe itself, not just
 * top-level navigation — shouldOverrideUrlLoading fires for iframe navigation too. iOS only needs it for
 * top-level navigation (e.g. the PHC login redirect).
 *
 * The dev LAN IP (`networkhost.ip` in pubhubs/pubhubs.toml) changes per developer machine/network, so it
 * can't be hardcoded here. It's generated into the gitignored capacitor.config.local.json by `npm run
 * sync:networkhost-ip` (see scripts/sync-networkhost-ip.js), the same way ios/App/App/Info.plist's ATS
 * exception is — see docs/app/README.md. Absent (e.g. in CI/release builds that never run that script),
 * this contributes nothing and allowNavigation stays at just ['localhost'].
 */
function readDevNetworkhostIp(): string | undefined {
	const localConfigPath = path.join(__dirname, 'capacitor.config.local.json');
	if (!fs.existsSync(localConfigPath)) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
		return typeof parsed.networkhostIp === 'string' && parsed.networkhostIp.length > 0 ? parsed.networkhostIp : undefined;
	} catch (err) {
		console.warn('capacitor.config.ts: failed to read capacitor.config.local.json, ignoring:', err);
		return undefined;
	}
}

const devNetworkhostIp = readDevNetworkhostIp();

const config: CapacitorConfig = {
	appId: 'nl.pubhubs.client',
	appName: 'PubHubs',
	webDir: 'global-client/dist',
	server: {
		cleartext: true,
		hostname: NATIVE_SHELL_APP_HOSTNAME,
		androidScheme: 'https',
		iosScheme: 'capacitor',
		allowNavigation: devNetworkhostIp ? ['localhost', devNetworkhostIp] : ['localhost'],
	},
	android: {
		buildOptions: {
			keystorePath: undefined,
		},
	},
};

export default config;
