import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';
import { type MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';

import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('matrixKeyProvider');

function membershipIdentity(membership: unknown): string | undefined {
	if (typeof membership !== 'object' || membership === null) return undefined;
	const { userId, deviceId } = membership as { userId?: unknown; deviceId?: unknown };
	return typeof userId === 'string' && typeof deviceId === 'string' ? `${userId}:${deviceId}` : undefined;
}

export class MatrixKeyProvider extends BaseKeyProvider {
	private rtcSession: MatrixRTCSession | null = null;
	private keys = new Map<string, Map<number, Uint8Array>>();

	public constructor() {
		//super({ sharedKey: false });

		// ratchetWindowSize: deriving the next key from the current one without sending a new one. Livekit supports it, Matrix not yet.
		// To keep it futureproof Element passes 10, so that when Matrix starts supporting it, the calls keep working
		// The overhead it costs now is minimal
		// Set the keyRingSize to minimize the chance of collision of keys
		super({ sharedKey: false, ratchetWindowSize: 10, keyringSize: 256 });
	}

	public setRTCSession(rtcSession: MatrixRTCSession): void {
		// Remove old listener if exists
		if (this.rtcSession) {
			this.rtcSession.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
		}

		this.rtcSession = rtcSession;

		// Attach listener
		this.rtcSession.on(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);

		// Use nextTick or setTimeout to ensure listener is registered
		// before reemitting keys
		setTimeout(() => {
			this.rtcSession?.reemitEncryptionKeys();
		}, 0);
	}

	// LiveKit looks up decryption keys by participant identity, which the hub issues as `user:device`.
	private onEncryptionKeyChanged = (encryptionKey: Uint8Array, encryptionKeyIndex: number, membership: unknown, rtcBackendIdentity?: string): void => {
		const participantId = rtcBackendIdentity ?? membershipIdentity(membership);
		if (!participantId) return;

		createKeyMaterialFromBuffer(encryptionKey.buffer as ArrayBuffer)
			.then((keyMaterial) => {
				this.onSetEncryptionKey(keyMaterial, participantId, encryptionKeyIndex);
				if (!this.keys.has(participantId)) {
					this.keys.set(participantId, new Map());
				}
				this.keys.get(participantId)?.set(encryptionKeyIndex, encryptionKey);
			})
			.catch((error) => logger.error('E2EE key material failed', error));
	};
}
