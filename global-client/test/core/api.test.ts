import { describe, expect, test, afterAll, afterEach, beforeAll } from 'vitest';
import { server } from '../mocks/server';
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
		expect(api.baseURL).toBe('http://test');

		expect(Object.keys(api.apiURLS).length).toBe(5);
		expect(api.apiURLS.login).toBe('http://test/login');
		expect(api.apiURLS.loginEn).toBe('http://test/en/login');
		expect(api.apiURLS.logout).toBe('http://test/logout');
		expect(api.apiURLS.bar).toBe('http://test/bar/state');
		expect(api.apiURLS.hubs).toBe('http://test/bar/hubs');
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

describe('api fetches', () => {
	test('api - hubs', async () => {
		const resp = await api.api(api.apiURLS.hubs);
		expect(resp).toBeTypeOf('object');
		expect(resp).toHaveLength(3);
		expect(resp[0]).toBeTypeOf('object');
		expect(resp[0]).toHaveProperty('name');
		expect(resp[0].name).toBeTypeOf('string');
		expect(resp[0].name.length).toBeGreaterThan(1);
		expect(resp[0]).toHaveProperty('client_uri');
		expect(resp[0].client_uri).toBeTypeOf('string');
		expect(resp[0].client_uri.length).toBeGreaterThan(8);
		expect(resp[0]).toHaveProperty('description');
		expect(resp[0].description).toBeTypeOf('string');
	});

	test('api - bar state', async () => {
		await expect(api.api(api.apiURLS.bar)).rejects.toThrowError();

		await api.api(api.apiURLS.login);
		const resp = await api.api(api.apiURLS.bar);
		expect(resp).toBeTypeOf('object');
		expect(resp).toHaveProperty('theme');
		expect(resp.theme).toBeTypeOf('string');
		expect(resp).toHaveProperty('language');
		expect(resp.language).toBeTypeOf('string');
		expect(resp).toHaveProperty('hubs');
		expect(resp.hubs).toBeTypeOf('object');
	});
});
