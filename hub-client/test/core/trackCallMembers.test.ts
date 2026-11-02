// Packages
import { describe, expect, test, vi } from 'vitest';

// Logic
import { trackCallMembers } from '@hub-client/logic/core/trackCallMembers';

vi.mock('@matrix-org/matrix-sdk-crypto-wasm', () => ({
	UserId: class {
		constructor(private readonly id: string) {}
		toString() {
			return this.id;
		}
	},
}));

function clientWithCrypto(crypto: unknown) {
	return { getCrypto: () => crypto } as never;
}

describe('trackCallMembers', () => {
	test('tracks the members and fetches their device lists before resolving', async () => {
		const order: string[] = [];
		const updateTrackedUsers = vi.fn(async () => {
			order.push('track');
		});
		const doProcessOutgoingRequests = vi.fn(async () => {
			order.push('fetch devices');
		});

		await trackCallMembers(clientWithCrypto({ olmMachine: { updateTrackedUsers }, outgoingRequestsManager: { doProcessOutgoingRequests } }), [
			'@a:hub',
			'@b:hub',
		]);

		expect(updateTrackedUsers.mock.calls[0][0].map(String)).toEqual(['@a:hub', '@b:hub']);
		expect(order).toEqual(['track', 'fetch devices']);
	});

	test('does not throw when the SDK internals it relies on are missing, so a call can still start', async () => {
		await expect(trackCallMembers(clientWithCrypto({}), ['@a:hub'])).resolves.toBeUndefined();
		await expect(trackCallMembers(clientWithCrypto(undefined), ['@a:hub'])).resolves.toBeUndefined();
	});
});
