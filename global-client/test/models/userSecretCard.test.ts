// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as TPHC from '@global-client/models/MSS/TPHC';
// Models
import UserSecretManager from '@global-client/models/MSS/UserSecret';

// The secret the account was registered with, as the email entry holds it.
const SECRET = new Uint8Array([1, 2, 3, 4]);
const EMAIL_ENTRY = { ts: 'ts-1', encUserSecret: Buffer.from(SECRET).toString('base64') };

// Encryption is the identity here, so what a stored entry holds can be read straight back: these
// tests are about which attributes get an entry and which secret ends up in it, not about the cipher.
const objectStore = {
	stored: {} as Record<string, Uint8Array>,
	getUserObject: vi.fn(async (handle: string) =>
		objectStore.stored[handle] ? { object: objectStore.stored[handle].buffer as ArrayBuffer, details: { hash: 'h' } } : null,
	),
	storeObject: vi.fn(async (handle: string, data: Uint8Array) => {
		objectStore.stored[handle] = data;
		return true;
	}),
	encryptData: vi.fn(async (data: Uint8Array) => data),
	decryptData: vi.fn(async (ciphertext: Uint8Array) => ciphertext),
	triggerLogoutProcedure: vi.fn(),
};

const storedObject = (handle: string) => JSON.parse(new TextDecoder().decode(objectStore.stored[handle])) as TPHC.UserSecretObjectNew;

// What registration leaves behind: the secret stored for the email that was disclosed.
const objectWithEmailOnly = (): TPHC.UserSecretObjectNew => ({ version: 1, data: { email: { 'someone@example.com': { ...EMAIL_ENTRY } } } });

// What a card login discloses, and the key handed out for it.
const cardAttr = { signedAttr: 'jwt', id: 'ph_card', value: 'card-pseudonym' };
const cardAttrKeys = { ph_card: { latest_key: ['a2V5', 'ts-2'] as [string, string], old_key: null } };

describe('A PubHubs card issued after the login that stored the user secret', () => {
	beforeEach(() => {
		// `getUserSecretInfo()` reaches for the global store to check a user is logged in.
		setActivePinia(createPinia());
		objectStore.stored = {};
		vi.clearAllMocks();
	});

	test('cannot be stored the ordinary way, because nothing disclosed can decrypt the secret', async () => {
		// The regression this guards: a card that reaches the account without an entry of its own locks
		// the account, because it is the only attribute the next login discloses.
		const manager = new UserSecretManager(objectStore);

		await expect(manager.storeUserSecretObject(cardAttrKeys, { ph_card: cardAttr }, objectWithEmailOnly(), null)).rejects.toThrow(
			/Could not recover the user secret/,
		);
	});

	test('is stored for the card, holding the secret the account already had', async () => {
		const manager = new UserSecretManager(objectStore);
		// The login that entered the account cached the secret; that is where this one comes from.
		localStorage.setItem('UserSecret', Buffer.from(SECRET).toString('base64'));

		await manager.addIdentifyingAttr(cardAttrKeys, { ph_card: cardAttr }, objectWithEmailOnly(), null);

		const data = storedObject('usersecret').data;
		expect(data.ph_card['card-pseudonym'].encUserSecret).toBe(Buffer.from(SECRET).toString('base64'));
		// The entry the account already had is kept, so the other attribute still opens it.
		expect(data.email['someone@example.com']).toEqual(EMAIL_ENTRY);
		// Both copies are written, the backup last.
		expect(objectStore.stored.usersecretbackup).toEqual(objectStore.stored.usersecret);
	});

	test('lets the next login recover the secret from the card alone', async () => {
		const manager = new UserSecretManager(objectStore);
		localStorage.setItem('UserSecret', Buffer.from(SECRET).toString('base64'));

		await manager.addIdentifyingAttr(cardAttrKeys, { ph_card: cardAttr }, objectWithEmailOnly(), null);

		// A later login discloses the card and nothing else, and re-stores against the object written
		// above - the step that used to throw.
		const nextLogin = new UserSecretManager(objectStore);
		const rotatedKeys = { ph_card: { latest_key: ['bmV3', 'ts-3'] as [string, string], old_key: 'a2V5' } };

		await expect(nextLogin.storeUserSecretObject(rotatedKeys, { ph_card: cardAttr }, storedObject('usersecret'), null)).resolves.toBeUndefined();
		expect(storedObject('usersecret').data.ph_card['card-pseudonym'].ts).toBe('ts-3');
	});

	test('reports rather than invents a secret when the session has none', async () => {
		const manager = new UserSecretManager(objectStore);
		localStorage.removeItem('UserSecret');

		await expect(manager.addIdentifyingAttr(cardAttrKeys, { ph_card: cardAttr }, objectWithEmailOnly(), null)).rejects.toThrow(
			/user secret of this session is gone/,
		);
		expect(objectStore.stored.usersecret).toBeUndefined();
	});
});
