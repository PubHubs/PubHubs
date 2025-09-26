import PHCServer from '@/model/MSS/PHC';
import { PHCStateResp, PHCWelcomeResp } from '@/model/MSS/TMultiServerSetup';
import { http, HttpResponse } from 'msw';

let encryptedUserSecret = null;
let encryptedUserSecretBackup = null;

export const handlers = [
	http.get('http://test/login', () => {
		localStorage.setItem('PHauthToken', `{"auth_token":"someValue","expires":${Date.now() + 1000}}`);
		return new HttpResponse(null, { status: 200 });
	}),

	http.get('http://test/.ph/user/welcome', () => {
		const data: PHCWelcomeResp = {
			Ok: {
				constellation: {
					id: 'someId',
					created_at: Date.now(),
					transcryptor_url: 'http://transcryptor-test',
					transcryptor_jwt_key: 'transcryptorJWTkey',
					transcryptor_enc_key: 'transcryptorEncKey',
					transcryptor_master_enc_key_part: 'transcryptorMasterEncKeyPart',
					phc_url: 'http://phc-test',
					phc_jwt_key: 'phcJWTkey',
					phc_enc_key: 'phcEncKey',
					auths_url: 'http://auths-test',
					auths_jwt_key: 'authsJWTkey',
					auths_enc_key: 'authsEncKey',
					master_enc_key: 'masterEncKey',
					global_client_url: 'http://test',
					ph_version: 'someVersion',
				},
				hubs: {
					testhub0: { handles: ['testhub0', 'testhub0_alias'], name: 'TestHub0', description: 'Test Hub Zero', url: 'http://hubtest0/', id: 'testhub0id' },
					testhub1: { handles: ['testhub1', 'testhub1_alias'], name: 'TestHub1', description: 'Test Hub One', url: 'http://hubtest1/', id: 'testhub1id' },
					testhub2: { handles: ['testhub2', 'testhub2_alias'], name: 'TestHub2', description: 'Test Hub Two', url: 'http://hubtest2/', id: 'testhub2id' },
				},
			},
		};
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://test/.ph/user/state', () => {
		const data: PHCStateResp = {
			Ok: {
				State: {
					allow_login_by: ['someAttribute'],
					could_be_banned_by: ['someBannableAttribute'],
					stored_objects: {
						usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 },
						usersecretbackup: { hash: 'userSecretBackupHash', hmac: 'userSecretBackupHmac', size: 300 },
						globalsettings: { hash: 'globalSettingsHash', hmac: 'globalSettingsHmac', size: 350 },
					},
				},
			},
		};
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://test/.ph/user/obj/by-hash/globalSettingsHash/globalSettingsHmac', async () => {
		if (localStorage.getItem('PHauthToken')) {
			const data = {
				theme: 'system',
				timeformat: 'format24',
				language: 'en',
				hubs: [{ hubId: 'TestHub0-Id', hubName: 'Testhub0' }],
			};
			const encodedData = new TextEncoder().encode(JSON.stringify(data));
			const phcServer = new PHCServer();
			// Using the string index notation as escape hatch to get a hold of the private function _encryptData
			// https://github.com/microsoft/TypeScript/issues/19335
			const encodedKey = new Uint8Array(Buffer.from(localStorage.getItem('UserSecret'), 'base64'));
			const encryptedData = await phcServer['_encryptData'](encodedData, encodedKey);
			return HttpResponse.arrayBuffer(encryptedData.buffer, {
				headers: {
					'content-type': 'application/octet-stream',
				},
				status: 200,
			});
		}
	}),

	http.get('http://hubtest0/_synapse/client/.ph/info', () => {
		const data = { hub_client_url: 'http://hubtest0-client/', hub_version: 'versionHub0' };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://hubtest1/_synapse/client/.ph/info', () => {
		const data = { hub_client_url: 'http://hubtest1-client/', hub_version: 'versionHub1' };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://hubtest2/_synapse/client/.ph/info', () => {
		const data = { hub_client_url: 'http://hubtest2-client/', hub_version: 'versionHub2' };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://test/logout', () => {
		localStorage.removeItem('PHauthToken');
		localStorage.removeItem('UserSecret');
		return new HttpResponse(null, { status: 200 });
	}),

	http.post('http://test/.ph/user/obj/by-handle/usersecret', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecret = body;
		return HttpResponse.json({ Ok: { Stored: { hash: 'userSecretHash' } } }, { status: 200 });
	}),

	http.post('http://test/.ph/user/obj/by-hash/usersecret/userSecretHash', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecret = body;
		return HttpResponse.json({ Ok: { Stored: { hash: 'userSecretHash' } } }, { status: 200 });
	}),

	http.post('http://test/.ph/user/obj/by-handle/usersecretbackup', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecretBackup = body;
		return HttpResponse.json({ Ok: { Stored: { hash: 'userSecretBackupHash' } } }, { status: 200 });
	}),

	http.post('http://test/.ph/user/obj/by-hash/usersecretbackup/userSecretBackupHash', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecretBackup = body;
		return HttpResponse.json({ Ok: { Stored: { hash: 'userSecretHash' } } }, { status: 200 });
	}),

	http.get('http://test/.ph/user/obj/by-hash/userSecretHash/userSecretHmac', () => {
		return HttpResponse.arrayBuffer(encryptedUserSecret, {
			headers: {
				'content-type': 'application/octet-stream',
			},
			status: 200,
		});
	}),

	http.get('http://test/.ph/user/obj/by-hash/userSecretBackupHash/userSecretBackupHmac', () => {
		return HttpResponse.arrayBuffer(encryptedUserSecretBackup, {
			headers: {
				'content-type': 'application/octet-stream',
			},
			status: 200,
		});
	}),
];
