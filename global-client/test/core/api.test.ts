// Packages
// Tests
import { server } from '../mocks/server';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';



// Logic
import { api } from '@global-client/logic/core/api';

















beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());

describe('api', () => {
	test('api', () => {
		expect(api).toBeTypeOf('object');
	});

	test('api - apiURLS', () => {
		// @ts-ignore
		expect(api.baseURL).toBe('http://testdomain');

		expect(Object.keys(api.apiURLS).length).toBe(3);
		expect(api.apiURLS.login).toBe('http://testdomain/login');
		expect(api.apiURLS.loginEn).toBe('http://testdomain/en/login');
		expect(api.apiURLS.logout).toBe('http://testdomain/logout');
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
