import { describe, expect, it } from 'vitest';

import { base64UrlDecode, base64UrlEncode, encryptPushBlob, randomId } from '@global-client/logic/pushBlob';

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

/** Decrypts like PHC does (pubhubs/src/servers/phc/push.rs's BlobKey::open). */
async function openBlob(phc: CryptoKeyPair, blob: string): Promise<unknown> {
	const bytes = base64UrlDecode(blob);
	expect(bytes[0]).toBe(1);
	const ephemeralPublic = bytes.slice(1, 66);
	const iv = bytes.slice(66, 78);
	const phcPublic = new Uint8Array(await crypto.subtle.exportKey('raw', phc.publicKey));

	const ephemeral = await crypto.subtle.importKey('raw', ephemeralPublic, ECDH, false, []);
	const secret = await crypto.subtle.deriveBits({ name: 'ECDH', public: ephemeral }, phc.privateKey, 256);
	const hkdfKey = await crypto.subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
	const info = new Uint8Array([...new TextEncoder().encode('pubhubs push blob v1'), ...ephemeralPublic, ...phcPublic]);
	const key = await crypto.subtle.deriveKey(
		{ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info },
		hkdfKey,
		{ name: 'AES-GCM', length: 256 },
		false,
		['decrypt'],
	);
	const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes.slice(78));
	return JSON.parse(new TextDecoder().decode(plaintext));
}

describe('pushBlob', () => {
	it('encrypts the target for PHC', async () => {
		const phc = (await crypto.subtle.generateKey(ECDH, true, ['deriveBits'])) as CryptoKeyPair;
		const phcKey = base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', phc.publicKey)));
		const target = { transport: 'apns', token: '00ff', tag: 'tag1' } as const;

		const blob = await encryptPushBlob(phcKey, target);
		expect(await openBlob(phc, blob)).toEqual(target);

		// A fresh blob every time, so hubs can't link users by it.
		expect(await encryptPushBlob(phcKey, target)).not.toEqual(blob);
	});

	it('makes random ids', () => {
		expect(randomId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
		expect(randomId()).not.toEqual(randomId());
	});

	it('base64url roundtrips', () => {
		const bytes = new Uint8Array([0, 251, 255, 62, 63]);
		expect(base64UrlDecode(base64UrlEncode(bytes))).toEqual(bytes);
	});
});
