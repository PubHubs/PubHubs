import { describe, expect, test } from 'vitest';

import { ApiError } from '@hub-client/logic/core/apiCore';
import { NetworkError, isNetworkError } from '@hub-client/logic/core/networkError';

describe('isNetworkError', () => {
	test.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.', 'Network request failed'])(
		'recognises fetch failure "%s"',
		(message) => {
			expect(isNetworkError(new TypeError(message))).toBe(true);
		},
	);

	test('recognises our own, matrix-js-sdk and timeout errors', () => {
		expect(isNetworkError(new NetworkError('https://hub.example'))).toBe(true);
		const connectionError = new Error('fetch failed');
		connectionError.name = 'ConnectionError';
		expect(isNetworkError(connectionError)).toBe(true);
		expect(isNetworkError(new DOMException('signal timed out', 'TimeoutError'))).toBe(true);
	});

	test('does not mistake answers, aborts or bugs for network errors', () => {
		expect(isNetworkError(new ApiError('Forbidden', 403))).toBe(false);
		expect(isNetworkError(new Error('RetryWithNewAuthToken'))).toBe(false);
		expect(isNetworkError(new DOMException('aborted', 'AbortError'))).toBe(false);
		expect(isNetworkError(new TypeError("Cannot read properties of undefined (reading 'x')"))).toBe(false);
		expect(isNetworkError('Failed to fetch')).toBe(false);
	});
});
