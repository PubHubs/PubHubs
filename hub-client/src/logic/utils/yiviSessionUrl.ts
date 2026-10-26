/**
 * Relaxes the sessionPtr URL check that `@privacybydesign/yivi-client` added in 1.0.1.
 *
 * That version refuses an `http:` sessionPtr URL unless the host is localhost, 127.0.0.1 or [::1].
 * Local development serves the Yivi requestor at `http://networkhost:8188` (see `requestor_url` in
 * `pubhubs/pubhubs.default.toml`), which is none of those, so the QR code and the "Open Yivi app"
 * button never render. Production is served over https and is unaffected.
 *
 * The replacement keeps every other check the original makes -- non-empty string, no
 * protocol-relative URL, parseable, http/https scheme only -- and drops only the localhost
 * restriction. Both clients run into this, so it lives here rather than in either yiviHandler.
 */
// Packages
import { SessionManagement } from '@privacybydesign/yivi-client';

// Stores
import { useSettings } from '@hub-client/stores/settings';

type SessionUrlAsserter = { _assertSafeSessionUrl: (url: string) => void; _pubhubsRelaxed?: true };

// Decided per call rather than at import: hub-client can't read Capacitor.DEBUG itself (Capacitor only
// injects it into the app shell's origin), so it learns that the app is a debug build from the handshake
// with global-client.
const insecureYiviSessionUrlsAllowed = (): boolean => import.meta.env.DEV || useSettings().isNativeDebugApp;

const allowInsecureYiviSessionUrlsInDev = (): void => {
	const prototype = SessionManagement.prototype as unknown as SessionUrlAsserter;
	if (prototype._pubhubsRelaxed) return;
	prototype._pubhubsRelaxed = true;

	const original = prototype._assertSafeSessionUrl;
	prototype._assertSafeSessionUrl = function (this: SessionUrlAsserter, url: string) {
		if (!insecureYiviSessionUrlsAllowed()) return original.call(this, url);

		if (typeof url !== 'string' || url.length === 0) throw new Error('Missing or invalid sessionPtr URL in mappings');
		if (url.startsWith('//')) throw new Error(`Refusing to use protocol-relative sessionPtr URL: ${url}`);

		let parsed: URL;
		try {
			parsed = new URL(url, window.location.href);
		} catch {
			throw new Error(`Invalid sessionPtr URL received from server: ${url}`);
		}

		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
			throw new Error(`Refusing to use sessionPtr URL with scheme "${parsed.protocol}": ${url}`);
		}
	};
};

export { allowInsecureYiviSessionUrlsInDev };
