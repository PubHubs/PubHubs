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
 * Gap between one miniclient starting and the next. Releasing them together would replace one
 * burst of work with another: each start is an iframe fetching a hub client, parsing it, and
 * opening a sync against a different host. Spacing them lets each get through its expensive
 * moment before the following one begins.
 */
const STAGGER_MS = 750;

/**
 * When the pinned-hub miniclients may start, and in what order.
 *
 * Every miniclient is an iframe that fetches a hub client, parses it, and opens a sliding sync of
 * its own. Starting all of them while the user is entering a hub puts that work in direct
 * competition with the one thing the user is actually waiting for, on the devices least able to
 * absorb it. So they are held back until either the hub being opened has finished starting up, or
 * there is no hub being opened at all — on the home page they are free to warm up immediately,
 * which is the point: by the time the user picks a hub, that work is already behind them.
 *
 * The gate opens once per page load and stays open. Re-closing it on every hub switch would
 * unmount running miniclients and throw away their warm sync, which costs more than it saves.
 *
 * Module-level state on purpose: one gate, one queue, shared by every HubMenuHubIcon.
 */
const started = ref(false);
let ceiling: ReturnType<typeof setTimeout> | null = null;

const waiting: Array<() => void> = [];
let pendingStep: ReturnType<typeof setTimeout> | null = null;
let lastGrantAt: number | null = null;

/** Open the gate. Idempotent; the first reason wins and is the one logged. */
function releaseMiniclients(reason: string) {
	if (started.value) return;
	if (ceiling) {
		clearTimeout(ceiling);
		ceiling = null;
	}
	started.value = true;
	logger.debug(`Miniclients released: ${reason}`);
	drain();
}

/**
 * Armed by a waiting miniclient rather than at module load, so the backstop only runs in a session
 * that actually renders one.
 */
function armCeiling() {
	if (started.value || ceiling) return;
	ceiling = setTimeout(() => releaseMiniclients('ceiling reached'), START_CEILING_MS);
}

/**
 * Let the next waiting miniclient start, then come back for the one after it.
 *
 * The gap is measured from the previous grant rather than held in a "currently draining" flag,
 * because the queue routinely runs dry between arrivals and a flag would let every late arrival
 * start on the spot. On the home page that is the normal path, not an edge case: the gate opens in
 * Home.vue's onMounted while the hub list is still being fetched from App.vue's onMounted, so every
 * icon joins an already-empty queue and the spacing would apply to none of them.
 */
function drain() {
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
}

/**
 * A ref that turns true when this miniclient's turn to start arrives: once the gate is open and
 * every miniclient queued ahead of it has had its turn. A hub pinned later joins the back of the
 * queue, and one unmounted while still waiting gives its place up.
 *
 * @param ready Whether this miniclient could actually start if it were granted its turn now. It
 *   only queues while this holds: a hub whose access token has not arrived yet would otherwise take
 *   a turn, render nothing, and spend the gap in front of the miniclient behind it on no work at
 *   all. Once granted the turn is kept — `ready` going false and true again does not requeue.
 *
 * Must be called from a component's setup, so the slot can be released on unmount.
 */
function useMiniclientStartSlot(ready: MaybeRefOrGetter<boolean>) {
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
}

/**
 * The releasing half of the gate, for the pages and stores that know the wait is over.
 *
 * Deliberately does not arm the ceiling: the backstop exists for miniclients that are waiting, and
 * they arm it themselves in useMiniclientStartSlot. Arming it here as well would start a timer on
 * every hub change, including in sessions that never render a miniclient at all.
 */
function useMiniclientGate() {
	return { releaseMiniclients };
}

export { useMiniclientGate, useMiniclientStartSlot };
