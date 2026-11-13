// Models
import { type Hub } from '@global-client/models/Hubs';

// Stores
import { useMSS } from '@global-client/stores/mss';

/**
 * Deactivate the user's account at one hub.
 *
 * The hub mints a state and nonce, PHC and the transcryptor turn those into a hashed hub
 * pseudonym, and the hub deactivates the account that pseudonym belongs to. A stale
 * constellation on either side is answered with RetryFromStart, hence the loop.
 *
 * The hub erases the account and unlinks it from the pseudonym, so this cannot be undone:
 * entering the hub again hands the user a new account with a new local pseudonym.
 *
 * @throws when the hub did not deactivate the account.
 */
const deactivateHubAccount = async (hub: Hub, accessToken: string): Promise<void> => {
	const mss = useMSS();
	const maxAttempts = 4;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const deactivateStartResp = await hub.deactivateStartEP(accessToken);

		const hhpp = await mss.obtainHhpp(hub.hubId, deactivateStartResp);
		if (!hhpp) {
			throw new Error('Failed to obtain HHPP for deactivation');
		}

		const deactivateCompleteResp = await hub.deactivateCompleteEP(deactivateStartResp.state, hhpp, accessToken);

		if (deactivateCompleteResp === 'Deactivated') {
			return;
		}
		if (deactivateCompleteResp !== 'RetryFromStart') {
			throw new Error(`Unexpected deactivation response: ${deactivateCompleteResp}`);
		}
	}

	throw new Error('Max attempts for RetryFromStart were passed');
};

export { deactivateHubAccount };
