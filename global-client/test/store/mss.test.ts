// Packages
import { EncryptVersion0 } from '../mocks/encryptVersion0';
import { server } from '../mocks/server';
import { HttpResponse, http } from 'msw';
import { createPinia, setActivePinia } from 'pinia';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { api } from '@global-client/logic/core/api';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { AttrKeyResp } from '@global-client/models/MSS/TAuths';
import { SignedIdentifyingAttrs } from '@global-client/models/MSS/TGeneral';
import { UserSecretData, UserSecretObject } from '@global-client/models/MSS/TPHC';

// Stores
import { useMSS } from '@global-client/stores/mss';

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
			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey1', '1'],
					old_key: null,
				},
			};
			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			expect(localStorage.getItem('UserSecret')).toBeNull();

			// Simulating the call to stateEP which would normally be performed when requesting the usersecret object to check if it already exists (in the login function), to initialize the "shadow record" of the user state.
			await phcServer.stateEP();
			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, null, null);

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(phcServer['_userSecretManager']['_userSecret']);
		});

		test('Logging in with a user secret of version 0', async () => {
			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey2', '2'],
					old_key: 'someKey1',
				},
			};
			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			// Use the old way of encoding the key
			const userSecret = globalThis.crypto.getRandomValues(new Uint8Array(32));
			const encUserSecret = await phcServer.encryptData(userSecret, new TextEncoder().encode('someKey1'));
			let oldUserSecretObject: UserSecretData = {
				emailAttrId: { emailAttrValue: { ts: '1', encUserSecret: Buffer.from(encUserSecret).toString('base64') } },
			};

			localStorage.removeItem('UserSecret');
			expect(localStorage.getItem('UserSecret')).toBeNull();

			// Simulating the call to stateEP which would normally be performed when requesting the usersecret object to check if it already exists (in the login function), to initialize the "shadow record" of the user state.
			await phcServer.stateEP();
			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, oldUserSecretObject, {
				usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 },
				backup: null,
			});

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(Buffer.from(userSecret).toString('base64'));

			const userSecretObject = await phcServer.getUserObject('usersecret');
			const backupObject = await phcServer.getUserObject('usersecretbackup');
			expect(userSecretObject.object).toEqual(backupObject.object);

			// Test if globalsettings encrypted with the old userSecret encoding can be retrieved without throwing an error on crypto.subtle.decrypt
			const globalSettings = globalThis.crypto.getRandomValues(new Uint8Array(32));
			const oldEncryptedGlobalSettings = await EncryptVersion0.encryptDataVersion0(globalSettings, 'ThisIsAUserSecret');
			const decodedGlobalSettings = await phcServer.decryptData(oldEncryptedGlobalSettings, 'ThisIsAUserSecret');
			expect(decodedGlobalSettings).toEqual(globalSettings);
		});

		test('Logging in with a user secret of version 1', async () => {
			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey3', '3'],
					old_key: 'someKey2',
				},
			};
			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = { email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' } };

			const { objectsEqual, userSecret: oldUserSecret, userSecretBackup } = await phcServer.getUserSecretObject();

			expect(objectsEqual).toBe(true);

			const userSecret = localStorage.getItem('UserSecret');

			localStorage.removeItem('UserSecret');
			expect(localStorage.getItem('UserSecret')).toBeNull();

			// Simulating the call to stateEP which would normally be performed when requesting the usersecret object to check if it already exists (in the login function), to initialize the "shadow record" of the user state.
			await phcServer.stateEP();
			await phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, oldUserSecret.object, {
				usersecret: oldUserSecret.details,
				backup: userSecretBackup.details,
			});

			expect(localStorage.getItem('UserSecret')).toBeTypeOf('string');
			expect(localStorage.getItem('UserSecret')).toEqual(userSecret);

			const userSecretObject = await phcServer.getUserObject('usersecret');
			const backupObject = await phcServer.getUserObject('usersecretbackup');
			expect(userSecretObject.object).toEqual(backupObject.object);
		});

		test('Decrypting a user secret object', async () => {
			const userSecret = localStorage.getItem('UserSecret');
			const userSecretBytes = new Uint8Array(Buffer.from(userSecret, 'base64'));
			const userSecretObject = await phcServer.getUserObject('usersecret');

			const decodedUserSecret = new TextDecoder().decode(userSecretObject.object);
			const parsedObject = JSON.parse(decodedUserSecret) as UserSecretObject;
			const decryptedUserSecretBytes = await phcServer['_userSecretManager']['_decryptUserSecret'](
				'someKey3',
				parsedObject.data['emailAttrId']['emailAttrValue'],
			);

			expect(userSecretBytes).toEqual(decryptedUserSecretBytes);
		});

		test('User secret encrypted for a different set of attribute keys', async () => {
			// Objects are equal at the start
			const beforeResp = await phcServer.getUserSecretObject();
			expect(beforeResp.objectsEqual).toBe(true);
			expect(beforeResp.userSecret.object).toEqual(beforeResp.userSecretBackup.object);

			// Adding a second attribute to encrypt the user secret for
			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey4', '4'],
					old_key: beforeResp.userSecret.object.data.emailAttrId
						? 'someKey' + beforeResp.userSecret.object.data.emailAttrId['emailAttrValue'].ts
						: null,
				},
				phonenumber: {
					latest_key: ['somePhoneKey1', '1'],
					old_key: beforeResp.userSecret.object.data.phoneAttrId
						? 'somePhoneKey' + beforeResp.userSecret.object.data.phoneAttrId['phoneAttrValue'].ts
						: null,
				},
			};

			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = {
				email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' },
				phonenumber: { id: 'phoneAttrId', signedAttr: 'signedPhoneAttr', value: 'phoneAttrValue' },
			};

			// Simulating the call to stateEP which would normally be performed when requesting the usersecret object to check if it already exists (in the login function), to initialize the "shadow record" of the user state.
			await phcServer.stateEP();

			// Only changing the stored usersecret object (keeping usersecretbackup the same)
			const userSecretObject = await phcServer['_userSecretManager']['_computeNewUserSecretObject'](
				mockedAttrKeysResp,
				mockedIdentifyingAttrs,
				beforeResp.userSecret.object,
			);
			const encodedObject: Uint8Array = new TextEncoder().encode(JSON.stringify(userSecretObject.newUserSecretObject));
			const storedUserSecret = await phcServer.storeObject('usersecret', encodedObject, beforeResp.userSecret.details.hash);
			expect(storedUserSecret).toBe(true);

			// Objects are not equal now
			const afterResp = await phcServer.getUserSecretObject();
			expect(afterResp.objectsEqual).toBe(false);
			expect(afterResp.userSecret.object).not.toEqual(afterResp.userSecretBackup.object);

			// But retrieving the usersecret from both usersecret and usersecretbackup, these agree about the actual user secret
			const mss = useMSS();
			const reqUserSecretResp = await mss.requestUserSecretObject(mockedIdentifyingAttrs);
			expect.assert(reqUserSecretResp.error === false);
			expect(reqUserSecretResp.userSecret.object).toEqual(reqUserSecretResp.userSecretBackup.object);
		});

		test('Differing secrets in usersecret and usersecretbackup objects', async () => {
			// Objects are equal at the start
			const beforeResp = await phcServer.getUserSecretObject();
			expect(beforeResp.objectsEqual).toBe(true);
			expect(beforeResp.userSecret.object).toEqual(beforeResp.userSecretBackup.object);

			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey5', '5'],
					old_key: beforeResp.userSecret.object.data.emailAttrId
						? 'someKey' + beforeResp.userSecret.object.data.emailAttrId['emailAttrValue'].ts
						: null,
				},
				phonenumber: {
					latest_key: ['somePhoneKey2', '2'],
					old_key: beforeResp.userSecret.object.data.phoneAttrId
						? 'somePhoneKey' + beforeResp.userSecret.object.data.phoneAttrId['phoneAttrValue'].ts
						: null,
				},
			};

			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = {
				email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' },
				phonenumber: { id: 'phoneAttrId', signedAttr: 'signedPhoneAttr', value: 'phoneAttrValue' },
			};

			// Act as if there is no existing usersecret object yet, so a new secret will be generated
			const userSecretObject = await phcServer['_userSecretManager']['_computeNewUserSecretObject'](mockedAttrKeysResp, mockedIdentifyingAttrs, null);
			const encodedObject: Uint8Array = new TextEncoder().encode(JSON.stringify(userSecretObject.newUserSecretObject));
			const storedUserSecret = await phcServer.storeObject('usersecret', encodedObject, beforeResp.userSecret.details.hash);
			expect(storedUserSecret).toBe(true);

			// Objects are not equal now
			const afterResp = await phcServer.getUserSecretObject();
			expect(afterResp.objectsEqual).toBe(false);
			expect(afterResp.userSecret.object).not.toEqual(afterResp.userSecretBackup.object);

			// And after retrieving the usersecret from both usersecret and usersecretbackup, these still do not agree about the actual user secret
			const errorLogMock = vi.spyOn(console, 'error').mockImplementation(() => {});
			const mss = useMSS();
			const reqUserSecretResp = await mss.requestUserSecretObject(mockedIdentifyingAttrs);

			expect.assert(reqUserSecretResp.error === true);
			expect(errorLogMock).toHaveBeenCalledWith(
				'[UserSecret]',
				expect.stringContaining('Different user secrets are stored in the usersecret and usersecretbackup objects.'),
			);
			errorLogMock.mockRestore();
		});

		test('Fail to overwrite', async () => {
			// Reset the usersecret object to make sure it is equal to the usersecretbackup object
			const { userSecret, userSecretBackup } = await phcServer.getUserSecretObject();
			const stored = await phcServer.storeObject('usersecret', new Uint8Array(userSecretBackup.rawData), userSecret.details.hash);
			expect.assert(stored === true);

			// Objects are equal at the start
			const beforeResp = await phcServer.getUserSecretObject();
			expect(beforeResp.objectsEqual).toBe(true);
			expect(beforeResp.userSecret.object).toEqual(beforeResp.userSecretBackup.object);

			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey6', '6'],
					old_key: beforeResp.userSecret.object.data.emailAttrId
						? 'someKey' + beforeResp.userSecret.object.data.emailAttrId['emailAttrValue'].ts
						: null,
				},
				phonenumber: {
					latest_key: ['somePhoneKey3', '3'],
					old_key: beforeResp.userSecret.object.data.phoneAttrId
						? 'somePhoneKey' + beforeResp.userSecret.object.data.phoneAttrId['phoneAttrValue'].ts
						: null,
				},
			};

			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = {
				email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' },
				phonenumber: { id: 'phoneAttrId', signedAttr: 'signedPhoneAttr', value: 'phoneAttrValue' },
			};

			// Only changing the stored usersecret object (keeping usersecretbackup the same)
			const userSecretObject = await phcServer['_userSecretManager']['_computeNewUserSecretObject'](
				mockedAttrKeysResp,
				mockedIdentifyingAttrs,
				beforeResp.userSecret.object,
			);
			const encodedObject: Uint8Array = new TextEncoder().encode(JSON.stringify(userSecretObject.newUserSecretObject));
			const storedUserSecret = await phcServer.storeObject('usersecret', encodedObject, beforeResp.userSecret.details.hash);
			expect(storedUserSecret).toBe(true);

			// Objects are now different
			const betweenResp = await phcServer.getUserSecretObject();
			expect(betweenResp.objectsEqual).toBe(false);
			expect(betweenResp.userSecret.object).not.toEqual(betweenResp.userSecretBackup.object);

			// Add a mock function such that trying to overwrite the usersecret object will fail with a PleaseRetry response
			const overwriteSpy = vi.fn();
			const errorLogMock = vi.spyOn(console, 'error').mockImplementation(() => {});
			server.use(
				http.post('http://testdomain/.ph/user/obj/by-hash/usersecret/userSecretHash', () => {
					overwriteSpy();
					return HttpResponse.json({ Ok: 'PleaseRetry' }, { status: 200 });
				}),
			);

			// Try to reset the usersecret object to make it equal to usersecretbackup again
			const mss = useMSS();
			const failed = await mss.requestUserSecretObject(mockedIdentifyingAttrs);
			// There should have been 3 tries to overwrite
			expect(overwriteSpy).toHaveBeenCalledTimes(3);
			// Resetting the usersecret is not successfull
			expect.assert(failed.error === true);
			expect(errorLogMock).toHaveBeenCalledWith('[UserSecret]', expect.stringContaining('Resetting the user secret was not successful.'));
			errorLogMock.mockRestore();
			server.resetHandlers();

			// The objects are still different
			const afterResp = await phcServer.getUserSecretObject();
			expect(afterResp.objectsEqual).toBe(false);
			expect(afterResp.userSecret.object).not.toEqual(afterResp.userSecretBackup.object);
		});

		test('Wrong encryption', async () => {
			// Reset the usersecret object to make sure it is equal to the usersecretbackup object
			const { userSecret, userSecretBackup } = await phcServer.getUserSecretObject();
			const stored = await phcServer.storeObject('usersecret', new Uint8Array(userSecretBackup.rawData), userSecret.details.hash);
			expect.assert(stored === true);

			// Objects are equal at the start
			const beforeResp = await phcServer.getUserSecretObject();
			expect(beforeResp.objectsEqual).toBe(true);
			expect(beforeResp.userSecret.object).toEqual(beforeResp.userSecretBackup.object);

			const mockedAttrKeysResp: Record<string, AttrKeyResp> = {
				email: {
					latest_key: ['someKey7', '7'],
					old_key: beforeResp.userSecret.object.data.emailAttrId
						? 'someKey' + beforeResp.userSecret.object.data.emailAttrId['emailAttrValue'].ts
						: null,
				},
				phonenumber: {
					latest_key: ['somePhoneKey4', '4'],
					old_key: beforeResp.userSecret.object.data.phoneAttrId
						? 'somePhoneKey' + beforeResp.userSecret.object.data.phoneAttrId['phoneAttrValue'].ts
						: null,
				},
			};

			const mockedIdentifyingAttrs: SignedIdentifyingAttrs = {
				email: { id: 'emailAttrId', signedAttr: 'signedEmailAttr', value: 'emailAttrValue' },
				phonenumber: { id: 'phoneAttrId', signedAttr: 'signedPhoneAttr', value: 'phoneAttrValue' },
			};

			const encryptSpy = vi.spyOn(phcServer, 'encryptData').mockImplementationOnce(async (data: Uint8Array, key: Uint8Array) => {
				const encoder = new TextEncoder();
				const randomBits = crypto.getRandomValues(new Uint8Array(32));
				// Introduce a typo in the encryption
				const derivedKey = phcServer['_concatUint8Arrays']([randomBits, key, encoder.encode('keyWithTypo')]);
				const derivedIV = phcServer['_concatUint8Arrays']([randomBits, key, encoder.encode('iv')]);
				const aesKeyHash = await crypto.subtle.digest('SHA-256', derivedKey);
				const iv = await crypto.subtle.digest('SHA-256', derivedIV);
				const aesKey = await crypto.subtle.importKey('raw', aesKeyHash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
				const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, data);
				const cipherText = phcServer['_concatUint8Arrays']([randomBits, new Uint8Array(encryptedData)]);
				return cipherText;
			});

			await expect(
				phcServer.storeUserSecretObject(mockedAttrKeysResp, mockedIdentifyingAttrs, beforeResp.userSecret.object, {
					usersecret: beforeResp.userSecret.details,
					backup: beforeResp.userSecretBackup.details,
				}),
			).rejects.toThrow('Failed to decrypt the data.');
			expect(encryptSpy).toHaveBeenCalledTimes(2);
			encryptSpy.mockRestore();

			const afterResp = await phcServer.getUserSecretObject();
			expect(afterResp.objectsEqual).toBe(false);
			expect(afterResp.userSecret.object).not.toEqual(afterResp.userSecretBackup.object);

			// But retrieving the usersecret from both usersecret and usersecretbackup, these agree about the actual user secret
			const errorLogMock = vi.spyOn(console, 'error').mockImplementation(() => {});
			const mss = useMSS();
			const reqUserSecretResp = await mss.requestUserSecretObject(mockedIdentifyingAttrs);
			expect.assert(reqUserSecretResp.error === true);
			expect(errorLogMock).toHaveBeenCalledWith('[PHCServer]', expect.stringContaining('Failed to decrypt the data.'));
			errorLogMock.mockRestore();
		});

		test('Missing usersecretbackup object', async () => {
			// An interrupted login can leave the account with a usersecret object but no backup of it.
			server.use(
				http.get('http://testdomain/.ph/user/state', () => {
					const data = {
						Ok: {
							State: {
								allow_login_by: ['someAttribute'],
								could_be_banned_by: ['someBannableAttribute'],
								stored_objects: {
									usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 },
									globalsettings: { hash: 'globalSettingsHash', hmac: 'globalSettingsHmac', size: 350 },
								},
							},
						},
					};
					return HttpResponse.json(data, { status: 200 });
				}),
			);
			const warnLogMock = vi.spyOn(console, 'warn').mockImplementation(() => {});
			await phcServer.stateEP();

			// The user can still log in: usersecret is only left without a backup after it has been read
			// back and verified, so it is used as it is and the next store recreates the backup from it.
			const resp = await phcServer.getUserSecretObject();
			expect(resp.objectsEqual).toBe(true);
			expect(resp.userSecretBackup).toBeNull();
			expect(resp.userSecret.object.data).toBeDefined();
			expect(warnLogMock).toHaveBeenCalledWith('[UserSecret]', expect.stringContaining('No usersecretbackup object is stored'));
			warnLogMock.mockRestore();
		});
	});
});
