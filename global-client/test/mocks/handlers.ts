import PHCServer from '@/model/MSS/PHC';
import { PHCStateResp, PHCWelcomeResp } from '@/model/MSS/TMultiServerSetup';
import { http, HttpResponse } from 'msw';

export const handlers = [
	http.get('http://test/login', () => {
		sessionStorage.setItem('loggedIn', 'true');
		localStorage.setItem('PHauthToken', `{"auth_token":"someValue","expires":${Date.now() + 1000}}`);
		localStorage.setItem('UserSecret', 'someUserSecret');
		localStorage.setItem('UserSecretVersion', '1');
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
					stored_objects: { usersecret: { hash: 'userSecretHash', hmac: 'userSecretHmac', size: 300 }, globalsettings: { hash: 'globalSettingsHash', hmac: 'globalSettingsHmac', size: 350 } },
				},
			},
		};
		return HttpResponse.json(data, { status: 200 });
	}),

	http.get('http://test/.ph/user/obj/by-hash/globalSettingsHash/globalSettingsHmac', async () => {
		if (sessionStorage.getItem('loggedIn') && localStorage.getItem('PHauthToken')) {
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
			const encodedKey = new Uint8Array(Buffer.from('someUserSecret', 'base64'));
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
		sessionStorage.setItem('loggedIn', 'false');
		localStorage.removeItem('PHauthToken');
		localStorage.removeItem('UserSecret');
		return new HttpResponse(null, { status: 200 });
	}),

	http.get('http://test/bar/state', () => {
		if (sessionStorage.getItem('loggedIn')) {
			const data = {
				theme: 'system',
				language: 'en',
				hubs: [{ hubId: 'TestHub0-Id', hubName: 'Testhub0' }],
			};
			const encodedData = new TextEncoder().encode(JSON.stringify(data)).buffer;
			return HttpResponse.arrayBuffer(encodedData, {
				headers: {
					'content-type': 'application/octet-stream',
				},
				status: 200,
			});
		} else {
			return new HttpResponse(null, { status: 403 });
		}
	}),

	http.get('http://test/bar/hubs', () => {
		return HttpResponse.json(
			[
				{
					name: 'TestHub0',
					description: 'Test Hub Zero',
					client_uri: 'http://hubtest0',
				},
				{
					name: 'TestHub1',
					description: 'Test Hub One',
					client_uri: 'http://hubtest1',
				},
				{
					name: 'TestHub2',
					description: 'Test Hub Two',
					client_uri: 'http://hubtest2',
				},
			],
			{ status: 200 },
		);
	}),
];
