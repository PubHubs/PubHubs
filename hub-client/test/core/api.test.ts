// Packages
// Tests
import { server } from '../mocks/server';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';

// Stores
import { TSecuredRoom } from '@hub-client/stores/rooms';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('api_synapse', () => {
	test('api_synapse', () => {
		expect(api_synapse).toBeTypeOf('object');
	});

	test('api - apiURLS', () => {
		expect(api_synapse.baseURL).toBe('http://testdomain/_synapse/');
		expect(api_synapse.apiURLS.securedRooms).toBe('http://testdomain/_synapse/client/secured_rooms');
		expect(api_synapse.apiURLS.roomsAPIV2).toBe('http://testdomain/_synapse/admin/v2/rooms/');
		expect(api_synapse.apiURLS.usersAPIV1).toBe('http://testdomain/_synapse/admin/v1/users/');
		expect(api_synapse.apiURLS.securedRoom).toBe('http://testdomain/_synapse/client/srextra');
		expect(api_synapse.apiURLS.notice).toBe('http://testdomain/_synapse/client/notices');
		expect(api_synapse.apiURLS.usersAPIV3).toBe('http://testdomain/_synapse/admin/v3/users/');
		expect(api_synapse.apiURLS.roomsAPIV1).toBe('http://testdomain/_synapse/admin/v1/rooms/');
	});

	test('api - apiOptions', () => {
		expect(api_synapse.options.GET).toBeTypeOf('object');
		expect(Object.keys(api_synapse.options.GET).length).toBe(1);
		expect(api_synapse.options.GET).toHaveProperty('method');
		expect(api_synapse.options.GET.method).toBe('GET');

		expect(api_synapse.options.POST).toBeTypeOf('object');
		expect(Object.keys(api_synapse.options.POST).length).toBe(1);
		expect(api_synapse.options.POST).toHaveProperty('method');
		expect(api_synapse.options.POST.method).toBe('POST');

		expect(api_synapse.options.PUT).toBeTypeOf('object');
		expect(Object.keys(api_synapse.options.PUT).length).toBe(1);
		expect(api_synapse.options.PUT).toHaveProperty('method');
		expect(api_synapse.options.PUT.method).toBe('PUT');

		expect(api_synapse.options.DELETE).toBeTypeOf('object');
		expect(Object.keys(api_synapse.options.DELETE).length).toBe(1);
		expect(api_synapse.options.DELETE).toHaveProperty('method');
		expect(api_synapse.options.DELETE.method).toBe('DELETE');
	});
});

describe('api secured rooms', () => {
	test('GET', async () => {
		const resp = await api_synapse.apiGET(api_synapse.apiURLS.securedRooms);
		expect(resp).toBeTypeOf('object');
		expect(resp).toHaveLength(2);
		expect(resp[0]).toBeTypeOf('object');
		expect(resp[0]).toHaveProperty('room_name');
		expect(resp[0].room_name).toBeTypeOf('string');
		expect(resp[0]).toHaveProperty('accepted');
		expect(resp[0].accepted).toBeTypeOf('object');
		expect(resp[0]).toHaveProperty('user_txt');
		expect(resp[0].user_txt).toBeTypeOf('string');
		expect(resp[0]).toHaveProperty('type');
		expect(resp[0].type).toBeTypeOf('string');
	});

	test('POST', async () => {
		const body = {} as TSecuredRoom;
		await expect(api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.room_name = 'Secured';
		await expect(api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.user_txt = 'Bla Bla';
		await expect(api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.accepted = [];
		await expect(api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.type = 'some_type';
		await expect(api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body)).rejects.toThrowError('Error');

		body.type = 'ph.messages.restricted';
		const resp = await api_synapse.apiPOST(api_synapse.apiURLS.securedRooms, body);
		expect(resp).toBeTypeOf('object');
		expect(resp).toHaveProperty('room_name');
		expect(resp).toHaveProperty('room_id');
	});
});
