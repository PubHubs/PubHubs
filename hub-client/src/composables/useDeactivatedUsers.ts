// Packages
import { useI18n } from 'vue-i18n';

// Logic
import { api_synapse } from '@hub-client/logic/core/api';
import filters from '@hub-client/logic/core/filters';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { useUser } from '@hub-client/stores/user';

const logger = createLogger('deactivatedUsers');

// Matches MAX_USER_IDS_PER_QUERY in the hub's _hub_data_resource.py.
const MAX_USER_IDS_PER_QUERY = 200;

// Ids waiting to go out in the next request, and the flush that will take them. Components ask
// one user at a time - a timeline asks once per sender - so the asks are gathered and sent as a
// single query rather than one request per name on screen.
let pending = new Set<string>();
let flush: Promise<void> | null = null;

// Ids whose request is out, with the promise of that request. Asking about them again before it
// comes back would only send them twice.
const inFlight = new Map<string, Promise<void>>();

// How long to wait before asking again after a failed request. Nothing else asks again: the
// components ask once, when they first render a name.
const RETRY_DELAYS_MS = [2_000, 10_000, 30_000];

/**
 * Telling an account that is gone from a member who merely left.
 *
 * Matrix reports deactivation only to server admins, so this asks the hub. It matters for what
 * is shown: a deactivated user must not be rendered under their pseudonym, since that is the
 * one handle others remember them by, while someone who left a room still must be.
 */
const useDeactivatedUsers = () => {
	const user = useUser();
	const { t } = useI18n();

	const request = async (userIds: string[]): Promise<string[]> => {
		const query = userIds.map(encodeURIComponent).join(',');
		return await api_synapse.apiGET<string[]>(`${api_synapse.apiURLS.data}?data=deactivated_users&user_ids=${query}`);
	};

	const flushPending = async () => {
		const asked = [...pending].slice(0, MAX_USER_IDS_PER_QUERY);
		// Anything over the cap stays queued for the next flush.
		pending = new Set([...pending].slice(MAX_USER_IDS_PER_QUERY));
		flush = pending.size > 0 ? schedule() : null;

		if (asked.length === 0) return;

		const done = send(asked).finally(() => asked.forEach((userId) => inFlight.delete(userId)));
		asked.forEach((userId) => inFlight.set(userId, done));
		await done;
	};

	const send = async (asked: string[], attempt = 0): Promise<void> => {
		try {
			const deactivated = await request(asked);
			user.setDeactivationResults(asked, deactivated);
		} catch (error) {
			if (attempt < RETRY_DELAYS_MS.length) {
				logger.warn('Could not determine which users are deactivated; asking again shortly', error);
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
				return await send(asked, attempt + 1);
			}
			// Left unresolved so a later render asks again; until then these users keep the
			// pseudonym they are shown under today, which is the safe direction to fail in - it
			// shows too much rather than mislabelling a live member as a deleted account.
			logger.error('Could not determine which users are deactivated', error);
		}
	};

	const schedule = (): Promise<void> => Promise.resolve().then(flushPending);

	/**
	 * Make sure the hub has been asked about these users, skipping the ones already answered.
	 *
	 * @returns a promise that settles once the request carrying them has come back.
	 */
	const ensureKnown = async (userIds: string[]): Promise<void> => {
		const outstanding = new Set(userIds.map((userId) => inFlight.get(userId)).filter((request) => request !== undefined));
		const unknown = userIds.filter((userId) => userId && !user.deactivationIsResolved(userId) && !pending.has(userId) && !inFlight.has(userId));
		if (unknown.length === 0) {
			await Promise.all([...outstanding, flush ?? Promise.resolve()]);
			return;
		}

		unknown.forEach((userId) => pending.add(userId));
		flush ??= schedule();
		await Promise.all([...outstanding, flush]);
	};

	/**
	 * The name to show for a user where there is room for only one: their display name, else their
	 * pseudonym - unless their account was deleted.
	 *
	 * Asks the hub about users without a display name, which is how a deleted account presents
	 * itself, so the name changes to 'Deleted account' once the answer is in. Safe to call from a
	 * computed: each user is asked about once.
	 */
	const nameOf = (userId: string): string => {
		if (user.isDeactivatedUser(userId)) return t('others.deleted_account');

		const displayName = user.userDisplayName(userId);
		if (displayName) return displayName;

		void ensureKnown([userId]);
		return filters.extractPseudonym(userId);
	};

	return { ensureKnown, nameOf };
};

export { useDeactivatedUsers };
