// Packages
import { HttpResponse, http } from 'msw';

// Models
import PHCServer from '@global-client/models/MSS/PHC';
import { AuthAttrKeyReq } from '@global-client/models/MSS/TAuths';
import { PHCStateResp, PHCWelcomeResp } from '@global-client/models/MSS/TPHC';

let encryptedUserSecret = null;
let encryptedUserSecretBackup = null;

export const handlers = [
	http.get('http://testdomain/login', () => {
		localStorage.setItem('PHauthToken', `{"auth_token":"someValue","expires":${Date.now() + 1000}}`);
		return new HttpResponse(null, { status: 200 });
	}),

	http.get('http://testdomain/.ph/user/welcome', () => {
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
					global_client_url: 'http://testdomain',
					ph_version: 'someVersion',
				},
				// PHC advertises hub urls with the `/_synapse/client/` path attached, see
				// `BasicInfo::url` in pubhubs/src/hub.rs. Keep these in that shape, so clients
				// stripping the prefix before appending an endpoint stay covered.
				hubs: {
					testhub0: {
						handles: ['testhub0', 'testhub0_alias'],
						name: 'TestHub0',
						description: 'Test Hub Zero',
						url: 'http://hubtest0/_synapse/client/',
						id: 'testhub0id',
					},
					testhub1: {
						handles: ['testhub1', 'testhub1_alias'],
						name: 'TestHub1',
						description: 'Test Hub One',
						url: 'http://hubtest1/_synapse/client/',
						id: 'testhub1id',
					},
					testhub2: {
						handles: ['testhub2', 'testhub2_alias'],
						name: 'TestHub2',
						description: 'Test Hub Two',
						url: 'http://hubtest2/_synapse/client',
						id: 'testhub2id',
					},
				},
			},
		};
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://testdomain/.ph/user/state', () => {
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

	http.get('http://testdomain/.ph/user/obj/by-hash/globalSettingsHash/globalSettingsHmac', async () => {
		if (localStorage.getItem('PHauthToken')) {
			const data = {
				theme: 'system',
				timeformat: 'format24',
				language: 'nl',
				hubs: [{ hubId: 'TestHub0-Id', hubName: 'Testhub0' }],
			};
			const encodedData = new TextEncoder().encode(JSON.stringify(data));
			const phcServer = new PHCServer();
			const encodedKey = new Uint8Array(Buffer.from(localStorage.getItem('UserSecret'), 'base64'));
			const encryptedData = await phcServer.encryptData(encodedData, encodedKey);
			return HttpResponse.arrayBuffer(encryptedData.buffer, {
				headers: {
					'content-type': 'application/octet-stream',
				},
				status: 200,
			});
		}
	}),

	http.get('http://hubtest0/_synapse/client/.ph/info', () => {
		const data = { Ok: { hub_client_url: 'http://hubtest0-client/', hub_version: 'versionHub0' } };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://hubtest1/_synapse/client/.ph/info', () => {
		const data = { Ok: { hub_client_url: 'http://hubtest1-client/', hub_version: 'versionHub1' } };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://hubtest2/_synapse/client/.ph/info', () => {
		const data = { Ok: { hub_client_url: 'http://hubtest2-client/', hub_version: 'versionHub2' } };
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://testdomain/logout', () => {
		localStorage.removeItem('PHauthToken');
		localStorage.removeItem('UserSecret');
		return new HttpResponse(null, { status: 200 });
	}),

	http.post('http://testdomain/.ph/user/obj/by-handle/usersecret', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecret = body;
		return HttpResponse.json({ Ok: { Stored: { object_details: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 } } } }, { status: 200 });
	}),

	http.post('http://testdomain/.ph/user/obj/by-hash/usersecret/userSecretHash', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecret = body;
		return HttpResponse.json({ Ok: { Stored: { object_details: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 } } } }, { status: 200 });
	}),

	http.post('http://testdomain/.ph/user/obj/by-handle/usersecretbackup', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecretBackup = body;
		return HttpResponse.json(
			{ Ok: { Stored: { object_details: { hash: 'userSecretBackupHash', hmac: 'userSecretBackupHmac', size: 300 } } } },
			{ status: 200 },
		);
	}),

	http.post('http://testdomain/.ph/user/obj/by-hash/usersecretbackup/userSecretBackupHash', async ({ request }) => {
		const body = await request.arrayBuffer();
		encryptedUserSecretBackup = body;
		return HttpResponse.json(
			{ Ok: { Stored: { object_details: { hash: 'userSecretBackupHash', hmac: 'userSecretBackupHmac', size: 300 } } } },
			{ status: 200 },
		);
	}),

	http.get('http://testdomain/.ph/user/obj/by-hash/userSecretHash/userSecretHmac', () => {
		return HttpResponse.arrayBuffer(encryptedUserSecret, {
			headers: {
				'content-type': 'application/octet-stream',
			},
			status: 200,
		});
	}),

	http.get('http://testdomain/.ph/user/obj/by-hash/userSecretBackupHash/userSecretBackupHmac', () => {
		return HttpResponse.arrayBuffer(encryptedUserSecretBackup, {
			headers: {
				'content-type': 'application/octet-stream',
			},
			status: 200,
		});
	}),

	http.post('http://auths-test/.ph/attr-keys', async ({ request }) => {
		const requestData = await request.text();
		const requestBody = JSON.parse(requestData) as AuthAttrKeyReq;
		const data = {
			Ok: {
				Success: {
					email: {
						latest_key: ['someKey5', '5'],
						old_key: 'someKey' + requestBody.email.timestamp,
					},
					phonenumber: {
						latest_key: ['someKey5', '5'],
						old_key: 'somePhoneKey' + requestBody.phonenumber.timestamp,
					},
				},
			},
		};
		return HttpResponse.json(data, { status: 200 });
	}),
];
