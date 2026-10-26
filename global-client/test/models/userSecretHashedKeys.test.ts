// Packages
import { createHash } from 'node:crypto';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Models
import * as TPHC from '@global-client/models/MSS/TPHC';
import UserSecretManager from '@global-client/models/MSS/UserSecret';

// Stores
import { useMSS } from '@global-client/stores/mss';

const SECRET = new Uint8Array([1, 2, 3, 4]);
const OTHER_SECRET = new Uint8Array([5, 6, 7, 8]);
const entry = (secret: Uint8Array, ts = 'ts-1') => ({ ts, encUserSecret: Buffer.from(secret).toString('base64') });

// The attribute values PHC should no longer see, and the one the logins below disclose.
const EMAIL = 'someone@example.com';
const PHONE = '+31612345678';
const CARD = 'card-pseudonym';
const emailAttr = { signedAttr: 'jwt', id: 'email', value: EMAIL };
const emailKeys = { email: { latest_key: ['bmV3', 'ts-2'] as [string, string], old_key: 'b2xk' } };

const EMAIL_KEY = await TPHC.attrValueKey('email', EMAIL);
const PHONE_KEY = await TPHC.attrValueKey('phone', PHONE);
const CARD_KEY = await TPHC.attrValueKey('ph_card', CARD);

// Encryption is the identity here, as in userSecretCard.test.ts: these tests are about the keys the
// entries are stored under, not about the cipher.
const objectStore = {
	stored: {} as Record<string, Uint8Array>,
	getUserObject: vi.fn(async (handle: string) =>
		objectStore.stored[handle] ? { object: objectStore.stored[handle].buffer as ArrayBuffer, details: { hash: 'h', hmac: 'm', size: 0 } } : null,
	),
	storeObject: vi.fn(async (handle: string, data: Uint8Array) => {
		objectStore.stored[handle] = data;
		return true;
	}),
	encryptData: vi.fn(async (data: Uint8Array) => data),
	decryptData: vi.fn(async (ciphertext: Uint8Array) => ciphertext),
	triggerLogoutProcedure: vi.fn(),
};

const encode = (obj: TPHC.UserSecretObject) => new TextEncoder().encode(JSON.stringify(obj));
const storedText = (handle: string) => new TextDecoder().decode(objectStore.stored[handle]);
const storedObject = (handle: string) => JSON.parse(storedText(handle)) as TPHC.UserSecretObjectNew;
const fetchKeys = vi.fn(async () => ({ error: false as const, response: emailKeys }));

// What an account with three identifying attributes holds before this change, keyed by the values.
const rawData = (): TPHC.UserSecretData => ({
	email: { [EMAIL]: entry(SECRET) },
	phone: { [PHONE]: entry(SECRET) },
	ph_card: { [CARD]: entry(SECRET) },
});

function expectOnlyHashedKeys(handle: string) {
	const text = storedText(handle);
	for (const value of [EMAIL, PHONE, CARD]) {
		expect(text).not.toContain(value);
	}
	const object = storedObject(handle);
	expect(object.version).toBe(2);
	expect(Object.keys(object.data.email)).toEqual([EMAIL_KEY]);
}

describe('The user secret object keyed by hashed attribute values', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		objectStore.stored = {};
		localStorage.removeItem('UserSecret');
		vi.clearAllMocks();
	});

	test('keys an entry by SHA-256 over the attribute type and value, base64url without padding', async () => {
		const expected = createHash('sha256').update(`email\u0000${EMAIL}`).digest('base64url');
		expect(EMAIL_KEY).toBe(expected);
		expect(EMAIL_KEY).toMatch(/^[A-Za-z0-9_-]{43}$/);
	});

	test('writes a new account as version 2 without the attribute value', async () => {
		const manager = new UserSecretManager(objectStore);
		const newKeys = { email: { latest_key: ['bmV3', 'ts-1'] as [string, string], old_key: null } };

		await manager.storeUserSecretObject(newKeys, { email: emailAttr }, null, null);

		expectOnlyHashedKeys('usersecret');
		expect(objectStore.stored.usersecretbackup).toEqual(objectStore.stored.usersecret);
	});

	test.each([
		['version 1', (): TPHC.UserSecretObject => ({ version: 1, data: rawData() })],
		['legacy, without a version', (): TPHC.UserSecretObject => rawData()],
	])('decrypts a %s object and rewrites it as version 2, hashing the entries of undisclosed attributes too', async (_name, oldObject) => {
		const manager = new UserSecretManager(objectStore);

		await manager.storeUserSecretObject(emailKeys, { email: emailAttr }, oldObject(), null);

		expect(localStorage.getItem('UserSecret')).toBe(Buffer.from(SECRET).toString('base64'));
		expectOnlyHashedKeys('usersecret');
		const data = storedObject('usersecret').data;
		expect(data.email[EMAIL_KEY].ts).toBe('ts-2');
		// The entries for attributes this login did not disclose are kept, under their hashed key only.
		expect(data.phone).toEqual({ [PHONE_KEY]: entry(SECRET) });
		expect(data.ph_card).toEqual({ [CARD_KEY]: entry(SECRET) });
		expect(objectStore.stored.usersecretbackup).toEqual(objectStore.stored.usersecret);
	});

	test('requests the old key with the timestamp of the entry, whatever version the object is', async () => {
		const mss = useMSS();
		const v2: TPHC.UserSecretObject = { version: 2, data: { email: { [EMAIL_KEY]: entry(SECRET, 'ts-v2') } } };
		const v1: TPHC.UserSecretObject = { version: 1, data: { email: { [EMAIL]: entry(SECRET, 'ts-v1') } } };
		const legacy: TPHC.UserSecretObject = { email: { [EMAIL]: entry(SECRET, 'ts-legacy') } };

		expect((await mss.buildAttributeKeyRequest({ email: emailAttr }, v2)).email.timestamp).toBe('ts-v2');
		expect((await mss.buildAttributeKeyRequest({ email: emailAttr }, v1)).email.timestamp).toBe('ts-v1');
		expect((await mss.buildAttributeKeyRequest({ email: emailAttr }, legacy)).email.timestamp).toBe('ts-legacy');
		expect((await mss.buildAttributeKeyRequest({ email: emailAttr }, null)).email.timestamp).toBeNull();
	});

	describe('with copies in different versions', () => {
		const v1Copy = () => encode({ version: 1, data: rawData() });
		const v2Copy = (secret: Uint8Array) =>
			encode({ version: 2, data: { email: { [EMAIL_KEY]: entry(secret, 'ts-2') }, phone: { [PHONE_KEY]: entry(secret) } } });

		test.each([
			['a version 2 usersecret next to a version 1 backup', v2Copy(SECRET), v1Copy()],
			['a version 1 usersecret next to a version 2 backup', v1Copy(), v2Copy(SECRET)],
		])('resolves %s to the backup, and the next store writes both as version 2', async (_name, userSecretCopy, backupCopy) => {
			objectStore.stored = { usersecret: userSecretCopy, usersecretbackup: backupCopy };
			const manager = new UserSecretManager(objectStore);

			const resolved = await manager.resolveUserSecretObject({ email: emailAttr }, fetchKeys);

			expect.assert(resolved.error === false);
			expect(storedText('usersecret')).toBe(new TextDecoder().decode(backupCopy));
			expect.assert(resolved.userSecret !== null && resolved.userSecretBackup !== null);

			await manager.storeUserSecretObject(emailKeys, { email: emailAttr }, resolved.userSecret.object, {
				usersecret: resolved.userSecret.details,
				backup: resolved.userSecretBackup.details,
			});

			expect(localStorage.getItem('UserSecret')).toBe(Buffer.from(SECRET).toString('base64'));
			expectOnlyHashedKeys('usersecret');
			expect(objectStore.stored.usersecretbackup).toEqual(objectStore.stored.usersecret);
		});

		test('still refuses copies that hold different secrets', async () => {
			const userSecretCopy = v2Copy(OTHER_SECRET);
			objectStore.stored = { usersecret: userSecretCopy, usersecretbackup: v1Copy() };
			const manager = new UserSecretManager(objectStore);
			const errorLogMock = vi.spyOn(console, 'error').mockImplementation(() => {});

			const resolved = await manager.resolveUserSecretObject({ email: emailAttr }, fetchKeys);

			expect.assert(resolved.error === true);
			expect(errorLogMock).toHaveBeenCalledWith('[UserSecret]', expect.stringContaining('Different user secrets are stored'));
			// Neither copy is touched.
			expect(storedText('usersecret')).toBe(new TextDecoder().decode(userSecretCopy));
			expect(objectStore.storeObject).not.toHaveBeenCalled();
			errorLogMock.mockRestore();
		});
	});
});
