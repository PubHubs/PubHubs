/**
 * In the native app, hub-client is bundled into the app, and every hub gets its own origin for it:
 * `<label>.hubs.pubhubs-app.invalid`, with `<label>` derived from the hubId. That way the browser keeps
 * each hub apart from the app shell (`pubhubs-app.invalid`) and from the other hubs, just like on the
 * web where every hub serves hub-client from its own domain.
 *
 * The same label is computed by the hub itself (pubhubs_hub/modules/pubhubs/_native_app.py), which allows
 * its own origins in CORS; keep the two in sync (their tests share test vectors). The Android app
 * (HubOriginWebViewClient.java), which serves the bundle on these hosts, only checks a host's shape.
 */

const NATIVE_HUB_HOST_SUFFIX = '.hubs.pubhubs-app.invalid';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** A hubId is 32 random bytes, encoded as unpadded base64url (pubhubs/src/id.rs). */
const HUB_ID_BYTES = 32;

function base64UrlDecode(value: string): Uint8Array {
	if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error('not unpadded base64url');
	const base64 = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

/** Lowercase, unpadded RFC 4648 base32, same as Python's base64.b32encode(...).rstrip('=').lower(). */
function base32Encode(bytes: Uint8Array): string {
	let out = '';
	let buffer = 0;
	let bits = 0;
	for (const byte of bytes) {
		buffer = ((buffer << 8) | byte) & 0xffff;
		bits += 8;
		while (bits >= 5) {
			out += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
			bits -= 5;
		}
	}
	if (bits > 0) out += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
	return out;
}

/**
 * The hostname label for a hub. Hostnames ignore case, so the case-sensitive base64url hubId is re-encoded
 * as lowercase base32: 52 characters, within the 63 allowed per label.
 */
function nativeHubLabel(hubId: string): string {
	const bytes = base64UrlDecode(hubId);
	if (bytes.length !== HUB_ID_BYTES) throw new Error(`hubId should be ${HUB_ID_BYTES} bytes, got ${bytes.length}`);
	return base32Encode(bytes);
}

/**
 * The origin hub-client runs on for this hub in the native app. `protocol` is the app shell's own
 * `location.protocol`: the hubs are served under the same scheme as the shell ('https:' on Android,
 * 'capacitor:' on iOS).
 */
function nativeHubOrigin(hubId: string, protocol: string): string {
	return `${protocol}//${nativeHubLabel(hubId)}${NATIVE_HUB_HOST_SUFFIX}`;
}

/** Whether a page with this hostname runs on a hub's origin in the native app. */
function isNativeHubOrigin(hostname: string): boolean {
	return hostname.endsWith(NATIVE_HUB_HOST_SUFFIX);
}

/**
 * Stops a hub-client page that runs on one hub's native origin but was told (through `?hubId=`) it is a
 * different hub. Otherwise a compromised hub could navigate its own iframe to another hub's origin, point
 * it at a server of its choosing, and read that other hub's stored data from there.
 *
 * Throws, so call it at the top of an entry point, before the app is mounted.
 */
function assertNativeHubOriginMatchesHubId(hostname: string, hubId: string | null): void {
	if (!hostname.endsWith(NATIVE_HUB_HOST_SUFFIX)) return;
	let expected: string | undefined;
	try {
		expected = hubId === null ? undefined : nativeHubLabel(hubId) + NATIVE_HUB_HOST_SUFFIX;
	} catch {
		expected = undefined;
	}
	if (hostname !== expected) {
		throw new Error(`hub-client refuses to start: origin ${hostname} does not belong to hubId ${hubId}`);
	}
}

export { assertNativeHubOriginMatchesHubId, isNativeHubOrigin, nativeHubLabel, nativeHubOrigin };
