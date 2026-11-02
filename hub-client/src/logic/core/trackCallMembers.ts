// Packages
import { UserId } from '@matrix-org/matrix-sdk-crypto-wasm';
import { type MatrixClient } from 'matrix-js-sdk';

import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('Videocall');

// The parts of matrix-js-sdk's RustCrypto this relies on; it has no public API for them (checked against matrix-js-sdk 43.0.0).
type RustCryptoInternals = {
	olmMachine?: { updateTrackedUsers(users: UserId[]): Promise<void> };
	outgoingRequestsManager?: { doProcessOutgoingRequests(): Promise<void> };
};

/**
 * Make the encryption layer know the devices of everyone who may be in the call, before keys are shared.
 *
 * matrix-js-sdk only tracks the devices of people you share an *encrypted* room with. PubHubs rooms are not encrypted,
 * so MatrixRTC would send call keys to devices it has never heard of — and drop them silently, without retrying.
 * Tracking the room's members (and fetching their device lists right away) closes that gap; later device changes then
 * arrive through sync.
 */
export async function trackCallMembers(client: MatrixClient, userIds: string[]): Promise<void> {
	const crypto = client.getCrypto() as unknown as RustCryptoInternals | undefined;
	const olmMachine = crypto?.olmMachine;
	const outgoingRequests = crypto?.outgoingRequestsManager;
	if (!olmMachine || !outgoingRequests) {
		logger.error('Cannot track call members: matrix-js-sdk crypto internals have changed; call keys may not reach everyone');
		return;
	}

	try {
		await olmMachine.updateTrackedUsers(userIds.map((userId) => new UserId(userId)));
		await outgoingRequests.doProcessOutgoingRequests();
	} catch (error) {
		logger.error('Could not fetch the devices of the call members', { error });
	}
}
