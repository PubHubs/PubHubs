import { describe, expect, test, afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';
import { SecuredRoom } from '@/logic/store/rooms';
import { api_synapse } from '@/logic/core/api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('api_synapse', () => {
	test('api_synapse', () => {
		expect(api_synapse).toBeTypeOf('object');
	});

	test('api - apiURLS', () => {
		// @ts-ignore
		expect(api_synapse.baseURL).toBe('http://test/_synapse/');

		expect(api_synapse.apiURLS.securedRooms).toBe('http://test/_synapse/client/secured_rooms');
		expect(api_synapse.apiURLS.roomsAPIV2).toBe('http://test/_synapse/admin/v2/rooms/');
		expect(api_synapse.apiURLS.usersAPIV1).toBe('http://test/_synapse/admin/v1/users/');
		expect(api_synapse.apiURLS.securedRoom).toBe('http://test/_synapse/client/srextra');
		expect(api_synapse.apiURLS.notice).toBe('http://test/_synapse/client/notices');
		expect(api_synapse.apiURLS.usersAPIV3).toBe('http://test/_synapse/admin/v3/users/');
		expect(api_synapse.apiURLS.roomsAPIV1).toBe('http://test/_synapse/admin/v1/rooms/');
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
		const body = {} as SecuredRoom;
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

	test('DELETE', async () => {
		const room_id = 'roomid';
		await expect(api_synapse.apiDELETE(api_synapse.apiURLS.securedRooms)).rejects.toThrowError('Error');
		await expect(api_synapse.apiDELETE(api_synapse.apiURLS.securedRooms + '?room_id=')).rejects.toThrowError('Error');
		const resp = await api_synapse.apiDELETE(api_synapse.apiURLS.securedRooms + '?room_id=' + room_id);
		expect(resp).toBeTypeOf('object');
		expect(resp).toEqual({ deleted: 'ID:' + room_id });
	});
});
