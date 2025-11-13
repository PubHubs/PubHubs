import { EncryptVersion0 } from '../mocks/encryptVersion0';
// Packages
import { server } from '../mocks/server';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

let pinia;

describe('Multi-server setup', () => {
	let phcServer: PHCServer;
	beforeEach(async () => {
		pinia = createPinia();
		setActivePinia(pinia);
	});

	describe('Encrypting and decrypting a user secret', () => {
		beforeEach(async () => {
			// We expect to be logged in before doing anything with the user secret
			await api.api(api.apiURLS.login);
			phcServer = new PHCServer();
		});

		test('Generating a new user secret', async () => {
			const mockedAttrKeysResp: Record<string, MSS.AttrKeyResp> = {
				email: {
					latest_key: ['someKey1', 'timestamp1'],
					old_key: null,
				},
			};
			const mockedIdentifyingAttrs: MSS.SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			expect(localStorage.getItem('UserSecret')).toBeNull();

			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, null, null);

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(phcServer['_userSecret']);
			expect(localStorage.getItem('UserSecretVersion')).toEqual('1');
		});

		test('Logging in with a user secret of version 0', async () => {
			const mockedAttrKeysResp: Record<string, MSS.AttrKeyResp> = {
				email: {
					latest_key: ['someKey2', 'timestamp2'],
					old_key: 'someKey1',
				},
			};
			const mockedIdentifyingAttrs: MSS.SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			// Use the old way of encoding the key
			const userSecret = window.crypto.getRandomValues(new Uint8Array(32));
			const encUserSecret = await phcServer['_encryptData'](userSecret, new TextEncoder().encode('someKey1'));
			let oldUserSecretObject: MSS.UserSecretData = { emailAttrId: { emailAttrValue: { ts: 'timestamp1', encUserSecret: Buffer.from(encUserSecret).toString('base64') } } };

			localStorage.removeItem('UserSecret');
			expect(localStorage.getItem('UserSecret')).toBeNull();

			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, oldUserSecretObject, { usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 }, backup: null });

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(Buffer.from(userSecret).toString('base64'));
			expect(localStorage.getItem('UserSecretVersion')).toEqual('1');

			const userSecretObject = await phcServer.getUserObject('usersecret');
			const backupObject = await phcServer.getUserObject('usersecretbackup');
			expect(userSecretObject.object).toEqual(backupObject.object);

			// Test if globalsettings encrypted with the old userSecret encoding can be retrieved without throwing an error on crypto.subtle.decrypt
			const globalSettings = window.crypto.getRandomValues(new Uint8Array(32));
			const oldEncryptedGlobalSettings = await EncryptVersion0.encryptDataVersion0(globalSettings, 'ThisIsAUserSecret');
			const decodedGlobalSettings = await phcServer['_decryptData'](oldEncryptedGlobalSettings, 'ThisIsAUserSecret');
			expect(decodedGlobalSettings).toEqual(globalSettings);
		});

		test('Logging in with a user secret of version 1', async () => {
			const mockedAttrKeysResp: Record<string, MSS.AttrKeyResp> = {
				email: {
					latest_key: ['someKey3', 'timestamp2'],
					old_key: 'someKey2',
				},
			};
			const mockedIdentifyingAttrs: MSS.SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			const oldUserSecret = await phcServer['_getUserSecretObject']();

			const userSecret = localStorage.getItem('UserSecret');

			localStorage.removeItem('UserSecret');
			expect(localStorage.getItem('UserSecret')).toBeNull();

			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, oldUserSecret.object, {
				usersecret: oldUserSecret.details.usersecret,
				backup: oldUserSecret.details.backup,
			});

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(userSecret);
			expect(localStorage.getItem('UserSecretVersion')).toEqual('1');

			const userSecretObject = await phcServer.getUserObject('usersecret');
			const backupObject = await phcServer.getUserObject('usersecretbackup');
			expect(userSecretObject.object).toEqual(backupObject.object);
		});

		test('Decrypting a user secret object', async () => {
			const userSecret = localStorage.getItem('UserSecret');
			const userSecretBytes = new Uint8Array(Buffer.from(userSecret, 'base64'));
			const userSecretObject = await phcServer.getUserObject('usersecret');

			const decodedUserSecret = new TextDecoder().decode(userSecretObject.object);
			const parsedObject = JSON.parse(decodedUserSecret) as MSS.UserSecretObject;
			const decryptedUserSecretBytes = await phcServer['_decryptUserSecret']('someKey3', parsedObject.data['emailAttrId']['emailAttrValue'], Number(parsedObject.version));

			expect(userSecretBytes).toEqual(decryptedUserSecretBytes);
		});
	});
});
