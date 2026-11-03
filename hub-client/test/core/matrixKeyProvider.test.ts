// Packages
import type * as LivekitClient from 'livekit-client';
import { MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { describe, expect, test, vi } from 'vitest';

// Logic
import { MatrixKeyProvider } from '@hub-client/logic/core/matrixKeyProvider';

vi.mock('livekit-client', async () => {
	const actual = await vi.importActual<typeof LivekitClient>('livekit-client');
	return { ...actual, createKeyMaterialFromBuffer: vi.fn().mockResolvedValue({ type: 'raw' }) };
});

type KeyListener = (key: Uint8Array, index: number, membership: unknown, rtcBackendIdentity?: string) => void;

function providerWithSession() {
	let listener: KeyListener = () => {};
	const session = {
		on: vi.fn((event: string, callback: KeyListener) => {
			if (event === MatrixRTCSessionEvent.EncryptionKeyChanged) listener = callback;
		}),
		off: vi.fn(),
		reemitEncryptionKeys: vi.fn(),
	};
	const provider = new MatrixKeyProvider();
	const setKey = vi.fn();
	provider.on('setKey', setKey);
	provider.setRTCSession(session as never);
	return { emitKey: (...args: Parameters<KeyListener>) => listener(...args), setKey };
}

describe('MatrixKeyProvider', () => {
	test('registers a key under the LiveKit identity the backend reports', async () => {
		const { emitKey, setKey } = providerWithSession();

		emitKey(new Uint8Array([1, 2, 3]), 0, { userId: '@a:hub', deviceId: 'DEV1' }, '@a:hub:DEV1');
		await vi.waitFor(() => expect(setKey).toHaveBeenCalled());

		expect(setKey.mock.calls[0][0]).toMatchObject({ participantIdentity: '@a:hub:DEV1', keyIndex: 0 });
	});

	test('falls back to user:device, so two sessions of one user get separate keys', async () => {
		const { emitKey, setKey } = providerWithSession();

		emitKey(new Uint8Array([1]), 0, { userId: '@a:hub', deviceId: 'DEV1' });
		emitKey(new Uint8Array([2]), 0, { userId: '@a:hub', deviceId: 'DEV2' });
		await vi.waitFor(() => expect(setKey).toHaveBeenCalledTimes(2));

		const identities = setKey.mock.calls.map(([info]) => info.participantIdentity);
		expect(identities).toEqual(['@a:hub:DEV1', '@a:hub:DEV2']);
	});
});
