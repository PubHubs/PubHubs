// Packages
import { type MaybeRefOrGetter, onUnmounted, readonly, ref, toValue, watch } from 'vue';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('MiniclientGate');

/**
 * How long the miniclients wait before starting regardless. A hub that is slow, unreachable, or
 * running a client too old to report its unread state must not be able to keep the badges from
 * ever appearing.
 */
const START_CEILING_MS = 10_000;

/**
 * Gap between one miniclient starting and the next.
 */
const STAGGER_MS = 750;

/**
 * When the pinned-hub miniclients may start, and in what order.
 *
 * Every miniclient is an iframe that fetches a hub client, parses it, and opens a sliding sync of
 * its own. Starting all of them while the user is entering a hub puts that work in direct
 * competition with the one thing the user is actually waiting for (the hub-client).
 *  So the miniclients are queued until either the hub being opened has finished starting up, or
 * there is no hub being opened at all.
 *
 */
const started = ref(false);
let ceiling: ReturnType<typeof setTimeout> | null = null;

const waiting: Array<() => void> = [];
let pendingStep: ReturnType<typeof setTimeout> | null = null;
let lastGrantAt: number | null = null;

/** Open the gate. Idempotent; the first reason wins and is the one logged. */
const releaseMiniclients = (reason: string) => {
	if (started.value) return;
	if (ceiling) {
		clearTimeout(ceiling);
		ceiling = null;
	}
	started.value = true;
	logger.debug(`Miniclients released: ${reason}`);
	drain();
};

/**
 * Armed by a waiting miniclient rather than at module load, so the backstop only runs in a session
 * that actually renders one.
 */
const armCeiling = () => {
	if (started.value || ceiling) return;
	ceiling = setTimeout(() => releaseMiniclients('ceiling reached'), START_CEILING_MS);
};

/**
 * Let the next waiting miniclient start, then come back for the one after it.
 *
 * The gap is measured from the previous grant rather than held in a "currently draining" flag,
 * because the queue routinely runs dry between arrivals and a flag would let every late arrival
 * start on the spot.
 */
const drain = () => {
	if (pendingStep || !started.value || waiting.length === 0) return;

	const gap = lastGrantAt === null ? 0 : Math.max(0, lastGrantAt + STAGGER_MS - Date.now());

	pendingStep = setTimeout(() => {
		pendingStep = null;
		const next = waiting.shift();
		if (!next) return; // everyone queued left again while we waited
		lastGrantAt = Date.now();
		next();
		drain();
	}, gap);
};

/**
 * A ref that turns true when this miniclient's turn to start arrives: once the gate is open and
 * every miniclient queued ahead of it has had its turn. A hub pinned later joins the back of the
 * queue, and one unmounted while still waiting gives its place up.
 *
 * @param ready Whether this miniclient could actually start if it were granted its turn now.
 *
 * Must be called from a component's setup, so the slot can be released on unmount.
 */
const useMiniclientStartSlot = (ready: MaybeRefOrGetter<boolean>) => {
	armCeiling();

	const mayStart = ref(false);
	const grant = () => {
		mayStart.value = true;
	};

	const leaveQueue = () => {
		const queuedAt = waiting.indexOf(grant);
		if (queuedAt !== -1) waiting.splice(queuedAt, 1);
	};

	watch(
		() => toValue(ready),
		(isReady) => {
			if (mayStart.value) return; // already had its turn, nothing left to queue for
			if (!isReady) {
				leaveQueue();
				return;
			}
			if (!waiting.includes(grant)) waiting.push(grant);
			drain(); // no-op while the gate is still closed
		},
		{ immediate: true },
	);

	onUnmounted(leaveQueue);

	return readonly(mayStart);
};

/**
 * The releasing half of the gate, for the pages and stores that know the wait is over.
 */
function useMiniclientGate() {
	return { releaseMiniclients };
}

export { useMiniclientGate, useMiniclientStartSlot };
