// Packages
import { describe, expect, test, vi } from 'vitest';

// Logic
import { handleErrors } from '@global-client/logic/utils/mssUtils';

describe('handleErrors', () => {
	// Chrome's wording; Firefox says "NetworkError ..." and Safari "Load failed".
	test('retries a network error after waiting', async () => {
		const apiCallFn = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ Ok: 'done' });

		const start = Date.now();
		const result = await handleErrors<string>(apiCallFn);

		expect(result).toEqual('done');
		expect(apiCallFn).toHaveBeenCalledTimes(2);
		expect(Date.now() - start).toBeGreaterThanOrEqual(90);
	});

	test('does not retry other errors', async () => {
		const apiCallFn = vi.fn().mockRejectedValue(new Error('BadRequest'));

		await expect(handleErrors<string>(apiCallFn)).rejects.toThrow('BadRequest');
		expect(apiCallFn).toHaveBeenCalledTimes(1);
	});
});
