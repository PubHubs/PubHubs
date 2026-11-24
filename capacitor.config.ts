import { type CapacitorConfig } from '@capacitor/cli';
import fs from 'node:fs';
import path from 'node:path';

/**
 * A hostname the app owns exclusively — WebViewLocalServer (Android) / WKURLSchemeHandler (iOS) intercept
 * requests to this (scheme, host) pair locally. '.invalid' is reserved by RFC 2606 to never be a
 * resolvable TLD, so no ordinary browser page can ever be served under this origin, which is what makes
 * hub-client's NATIVE_SHELL_ORIGINS check (hub-client/src/stores/messagebox.ts) safe to trust
 * unconditionally.
 *
 * If you change this value, also update NATIVE_SHELL_ORIGINS to match — see the security note there.
 */
const NATIVE_SHELL_APP_HOSTNAME = 'pubhubs-app.invalid';

// Each hub's bundled hub-client runs on a subdomain of this, '<label>.hubs.pubhubs-app.invalid', so hubs
// are isolated from the app and from each other. These are not in allowNavigation on purpose: see
// android/.../HubOriginWebViewClient.java, which serves them, and hub-client's nativeHubOrigin.ts.

/**
 * Dev-only extra host the WebView may navigate to, on top of 'localhost'. Android needs this for the
 * hub-client iframe itself (shouldOverrideUrlLoading fires for iframe navigation too), iOS only for
 * top-level navigation (e.g. the PHC login redirect).
 *
 * Generated into the gitignored capacitor.config.local.json by `scripts/sync-networkhost-ip.js`, the
 * same way Info.plist's ATS exception is — see docs/app/README.md. Absent in builds that never run that
 * script (e.g. CI/release), leaving allowNavigation at just ['localhost']. Release syncs set
 * PUBHUBS_RELEASE so a leftover file from local development is ignored too.
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

const devNetworkhostIp = process.env.PUBHUBS_RELEASE ? undefined : readDevNetworkhostIp();

const config: CapacitorConfig = {
	appId: 'net.pubhubs.app',
	appName: 'PubHubs',
	webDir: 'global-client/dist',
	server: {
		// Plain HTTP is only needed to reach local development servers; release builds stay HTTPS-only.
		cleartext: !process.env.PUBHUBS_RELEASE,
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
	plugins: {
		StatusBar: {
			overlaysWebView: false,
			style: 'DEFAULT',
		},
	},
};

export default config;
