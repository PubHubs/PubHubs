/**
 * Encrypts the device's push token for PHC, for a hub's Matrix pusher (see nativePush.ts), and
 * opens the sealed tag a push carries.
 *
 * Every call gives a different blob, also for the same token, so hubs can't link users by them.
 * Must match pubhubs/src/servers/phc/push.rs: `2 ‖ ephemeral P-256 public key (65) ‖ iv (12) ‖
 * AES-256-GCM ciphertext and tag`, with the key from HKDF-SHA256 (empty salt) over the ECDH
 * secret, with info "pubhubs push blob v2" ‖ ephemeral public key ‖ PHC's public key.
 */

/**
 * Where PHC should push to. The tag (one per hub) maps back to the hub. PHC doesn't send it as is,
 * but sealed with the tag key (one per device), afresh for every push, see openSealedTag.
 */
type PushTarget = { tag: string; tag_key: string } & (
	{ transport: 'apns' | 'fcm'; token: string } | { transport: 'webpush'; endpoint: string; p256dh: string; auth: string }
);

const BLOB_VERSION = 2;
const BLOB_INFO = new TextEncoder().encode('pubhubs push blob v2');
const TAG_AAD = new TextEncoder().encode('pubhubs push tag v1');

function base64UrlEncode(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replace(/=+$/, '');
}

function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
	const base64 = text.replaceAll('-', '+').replaceAll('_', '/');
	return Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
	const out = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

/** Random base64url string, for pushkeys and tags. */
function randomId(bytes = 16): string {
	return base64UrlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** @param phcBlobKey PHC's public key, `blob_key` from `.ph/push/info`. */
async function encryptPushBlob(phcBlobKey: string, target: PushTarget): Promise<string> {
	const phcPublic = base64UrlDecode(phcBlobKey);
	const ecdh = { name: 'ECDH', namedCurve: 'P-256' };
	const phcKey = await crypto.subtle.importKey('raw', phcPublic, ecdh, false, []);
	const ephemeral = (await crypto.subtle.generateKey(ecdh, false, ['deriveBits'])) as CryptoKeyPair;
	const ephemeralPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));

	const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: phcKey }, ephemeral.privateKey, 256);
	const hkdfKey = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
	const aesKey = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: concat(BLOB_INFO, ephemeralPublic, phcPublic) },
		hkdfKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt'],
	);

	const iv = crypto.getRandomValues(new Uint8Array(12));
	const plaintext = new TextEncoder().encode(JSON.stringify(target));
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plaintext));
	return base64UrlEncode(concat(Uint8Array.of(BLOB_VERSION), ephemeralPublic, iv, ciphertext));
}

/**
 * The tag from a push's `sealed_tag`: `nonce (12) ‖ AES-256-GCM(tagKey, tag)`, base64url, as PHC's
 * seal_tag makes it. Undefined if it doesn't open with this tag key.
 */
async function openSealedTag(tagKey: string, sealedTag: string): Promise<string | undefined> {
	try {
		const sealed = base64UrlDecode(sealedTag);
		const key = await crypto.subtle.importKey('raw', base64UrlDecode(tagKey), 'AES-GCM', false, ['decrypt']);
		const tag = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: sealed.slice(0, 12), additionalData: TAG_AAD }, key, sealed.slice(12));
		return new TextDecoder().decode(tag);
	} catch {
		return undefined;
	}
}

export { BLOB_VERSION, type PushTarget, base64UrlDecode, base64UrlEncode, encryptPushBlob, openSealedTag, randomId };
