import { describe, expect, test, afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';
import { SecuredRoom } from '@/store/rooms';
import { api } from '@/core/api';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('api', () => {
	test('api', () => {
		expect(api).toBeTypeOf('object');
	});

	test('api - apiURLS', () => {
		// @ts-ignore
		expect(api.baseURL).toBe('http://test/_synapse/client');

		expect(Object.keys(api.apiURLS).length).toBe(1);
		expect(api.apiURLS.securedRooms).toBe('http://test/_synapse/client/secured_rooms');
	});

	test('api - apiOptions', () => {
		expect(api.options.GET).toBeTypeOf('object');
		expect(Object.keys(api.options.GET).length).toBe(1);
		expect(api.options.GET).toHaveProperty('method');
		expect(api.options.GET.method).toBe('GET');

		expect(api.options.POST).toBeTypeOf('object');
		expect(Object.keys(api.options.POST).length).toBe(1);
		expect(api.options.POST).toHaveProperty('method');
		expect(api.options.POST.method).toBe('POST');

		expect(api.options.PUT).toBeTypeOf('object');
		expect(Object.keys(api.options.PUT).length).toBe(1);
		expect(api.options.PUT).toHaveProperty('method');
		expect(api.options.PUT.method).toBe('PUT');

		expect(api.options.DELETE).toBeTypeOf('object');
		expect(Object.keys(api.options.DELETE).length).toBe(1);
		expect(api.options.DELETE).toHaveProperty('method');
		expect(api.options.DELETE.method).toBe('DELETE');
	});
});

describe('api secured rooms', () => {
	test('GET', async () => {
		const resp = await api.apiGET(api.apiURLS.securedRooms);
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
		await expect(api.apiPOST(api.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.room_name = 'Secured';
		await expect(api.apiPOST(api.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.user_txt = 'Bla Bla';
		await expect(api.apiPOST(api.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.accepted = [];
		await expect(api.apiPOST(api.apiURLS.securedRooms, body)).rejects.toThrowError('Error');
		body.type = 'some_type';
		await expect(api.apiPOST(api.apiURLS.securedRooms, body)).rejects.toThrowError('Error');

		body.type = 'ph.messages.restricted';
		const resp = await api.apiPOST(api.apiURLS.securedRooms, body);
		expect(resp).toBeTypeOf('object');
		expect(resp).toHaveProperty('room_name');
		expect(resp).toHaveProperty('room_id');
	});

	test('DELETE', async () => {
		const room_id = 'roomid';
		await expect(api.apiDELETE(api.apiURLS.securedRooms)).rejects.toThrowError('Error');
		await expect(api.apiDELETE(api.apiURLS.securedRooms + '?room_id=')).rejects.toThrowError('Error');
		const resp = await api.apiDELETE(api.apiURLS.securedRooms + '?room_id=' + room_id);
		expect(resp).toBeTypeOf('string');
		expect(resp).toEqual('ID:' + room_id);
	});
});
