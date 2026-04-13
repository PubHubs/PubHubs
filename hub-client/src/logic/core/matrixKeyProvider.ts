// Walter's code
// import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';
// import { MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
// export class MatrixKeyProvider extends BaseKeyProvider {
// 	private rtcSession: MatrixRTCSession | null = null;
// 	private keys = new Map<string, Map<number, Uint8Array>>();
// 	public constructor() {
// 		super({ sharedKey: false });
// 	}
// 	public setRTCSession(rtcSession: MatrixRTCSession): void {
// 		if (this.rtcSession) {
// 			this.rtcSession.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
// 		}
// 		this.rtcSession = rtcSession;
// 		this.rtcSession.off(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
// 		this.rtcSession.on(MatrixRTCSessionEvent.EncryptionKeyChanged, this.onEncryptionKeyChanged);
// 		// The new session could be aware of keys of which the old session wasn't,
// 		// so emit a key changed event.
// 		for (const [participant, encryptionKeys] of this.rtcSession.getEncryptionKeys()) {
// 			for (const [index, encryptionKey] of encryptionKeys.entries()) {
// 				this.onEncryptionKeyChanged(encryptionKey, index, participant);
// 			}
// 		}
// 	}
// 	private onEncryptionKeyChanged = async (encryptionKey: Uint8Array, encryptionKeyIndex: number, participantId: string): Promise<void> => {
// 		this.onSetEncryptionKey(await createKeyMaterialFromBuffer(encryptionKey.buffer as ArrayBuffer), participantId, encryptionKeyIndex);
// 		this.keys.set(participantId, new Map([[encryptionKeyIndex, encryptionKey]]));
// 	};
// }
import { BaseKeyProvider, createKeyMaterialFromBuffer } from 'livekit-client';
import { type MatrixRTCSession, MatrixRTCSessionEvent } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';

export class MatrixKeyProvider extends BaseKeyProvider {
	private rtcSession: MatrixRTCSession | null = null;
	private keys = new Map<string, Map<number, Uint8Array>>();

	public constructor() {
		super({ sharedKey: false });
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

	private onEncryptionKeyChanged = (encryptionKey: Uint8Array, encryptionKeyIndex: number, membership: unknown, rtcBackendIdentity?: string): void => {
		const membershipUserId =
			typeof membership === 'object' && membership !== null && 'userId' in membership && typeof membership.userId === 'string'
				? membership.userId
				: undefined;
		const participantId = membershipUserId ?? rtcBackendIdentity ?? 'unknown';

		createKeyMaterialFromBuffer(encryptionKey.buffer as ArrayBuffer)
			.then((keyMaterial) => {
				this.onSetEncryptionKey(keyMaterial, participantId, encryptionKeyIndex);
				if (!this.keys.has(participantId)) {
					this.keys.set(participantId, new Map());
				}
				this.keys.get(participantId)?.set(encryptionKeyIndex, encryptionKey);
			})
			.catch(() => undefined);
	};
}
