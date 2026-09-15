// Packages
import { YiviClient } from '@privacybydesign/yivi-client';
import { type StateChangeEvent, YiviCore, type YiviPlugin, type YiviState } from '@privacybydesign/yivi-core';
import { YiviWeb } from '@privacybydesign/yivi-web';
import { type Ref } from 'vue';

// Assets
import '@hub-client/assets/yivi.min.css';

import { createLogger } from '@hub-client/logic/logging/Logger';
import { allowInsecureYiviSessionUrlsInDev } from '@hub-client/logic/utils/yiviSessionUrl';

// Stores
import { useSettings } from '@hub-client/stores/settings';

// Types
type YiviSession = {
	/** Stop the session, rejecting the result promise it was handed out with. */
	abort: () => void;
};

/** Where a page wants the Yivi widget rendered, read when the session starts. */
type YiviMountPoint = Readonly<Ref<HTMLElement | null>>;

const logger = createLogger('YiviHandler');

// Counts the mount points that have been given a generated id, see `yiviElementSelector`.
let yiviMountCount = 0;

// The states yivi-core reaches when a session did not succeed. They only end the session when the
// widget cannot start it again by itself, see `endOnFailure`.
const noSuccessStates: Set<YiviState> = new Set(['Cancelled', 'TimedOut', 'Error']);

allowInsecureYiviSessionUrlsInDev();

/**
 * Whether the Yivi widget will offer a link that opens the Yivi app on this device, rather than a
 * QR code to be scanned with a second device.
 *
 * Mirrors the platform check in `@privacybydesign/yivi-client`'s `user-agent.js`
 */
const canOpenYiviApp = (): boolean => {
	if (typeof window === 'undefined') return false;

	const userAgent = window.navigator.userAgent;

	if (/Android/i.test(userAgent)) return true;
	if (/iPad|iPhone|iPod/.test(userAgent)) return true;

	// iPadOS 13 and up report themselves as a Mac; the touch points give them away.
	return /Macintosh/.test(userAgent) && window.navigator.maxTouchPoints > 2;
};

/**
 * A readable reason for a Yivi session that ended in failure.
 */
const describeSessionFailure = (reason: unknown): string => {
	const state: unknown = Array.isArray(reason) ? reason[0] : reason;
	if (typeof state === 'string') return state;
	try {
		return JSON.stringify(state) ?? 'undefined';
	} catch {
		return 'an error that could not be serialised';
	}
};

/**
 * The selector `yivi-web` needs for a mount point, which it resolves with `document.querySelector`.
 *
 * A selector that matches more than one element renders the widget into whichever comes first in the
 * document.
 */
const yiviElementSelector = (element: HTMLElement): string => {
	if (!element.id) element.id = `yivi-mount-${++yiviMountCount}`;
	return `#${element.id}`;
};

/**
 * Show the Yivi widget in `mountPoint` and run a session against `yiviRequestorUrl`.
 *
 * @param mountPoint The element to render the widget into.
 * @param endOnFailure Whether a session that did not succeed ends here rather than leaving the widget
 * to start it again, see below.
 * @returns The session, so a caller that is replaced or unmounted can stop it, together with the
 * promise carrying its result. The two are handed out together because a session left running keeps
 * polling the Yivi server and holds on to the element the next session renders into.
 *
 */
const startYiviAuthentication = (
	yiviRequestorUrl: string,
	disclosureRequest: string,
	mountPoint: YiviMountPoint,
	endOnFailure = false,
): { session: YiviSession; result: Promise<string> } => {
	const settings = useSettings();
	const element = mountPoint.value;
	if (!element) throw new Error('No element to render the Yivi widget into');

	let yivi: YiviCore;
	try {
		yivi = new YiviCore({
			debugging: false,
			element: yiviElementSelector(element),
			language: settings.getActiveLanguage as 'nl' | 'en' | undefined,
			session: {
				url: yiviRequestorUrl,
				start: {
					method: 'POST',
					body: disclosureRequest,
					headers: { 'Content-Type': 'text/plain' },
				},
			},
			state: {
				pairing: false,
			},
		});
		yivi.use(YiviWeb);
		yivi.use(YiviClient);
	} catch (initError) {
		logger.error('Yivi initialization failed:', initError);
		throw initError;
	}

	// Stopping the session rejects the result promise like any other failure, so the reason is
	// remembered to keep a session that was ended on purpose out of the error log.
	let stopped = false;
	let rejectStopped: (reason: Error) => void;
	const stoppedResult = new Promise<never>((_resolve, reject) => {
		rejectStopped = reject;
	});

	/**
	 * End the session and settle its result with `reason`.
	 *
	 * `YiviCore.abort()` is a no-op while the session is uninitialised or already in an end state, so
	 * the result is settled here rather than left to the core: a caller waiting for a session that has
	 * been stopped would otherwise wait for good.
	 */
	const stop = (reason: Error): void => {
		stopped = true;
		yivi.abort();
		rejectStopped(reason);
	};

	const session: YiviSession = { abort: () => stop(new Error('Yivi session aborted')) };

	if (endOnFailure) {
		yivi.use(
			class implements YiviPlugin {
				stateChange({ newState }: StateChangeEvent): void {
					if (!noSuccessStates.has(newState)) return;
					// Transitioning from here would move the state machine on while the other plugins are
					// still being told about this state, so it waits a tick.
					queueMicrotask(() => stop(new Error(`Yivi session ${newState.toLowerCase()}`)));
				}
			},
		);
	}

	const started = yivi
		.start()
		.then(async (response: unknown) => {
			const result = response as { token: string };

			const responseResultJWT = await fetch(`${yiviRequestorUrl}/session/${result.token}/result-jwt`);
			if (responseResultJWT.ok) {
				const resultJWT = await responseResultJWT.text();
				return resultJWT;
			} else {
				const errorText = await responseResultJWT.text();
				throw new Error(`Could not retrieve the Yivi JWT: ${errorText}`);
			}
		})
		.catch((startError: unknown) => {
			if (stopped) {
				logger.info('Yivi session stopped');
				throw new Error('Yivi session stopped');
			}
			// Rethrow. A caller that cannot tell a finished session from a failed one would carry an
			// `undefined` disclosure into the next request, or report a PubHubs card as issued that
			// never reached the user's Yivi app.
			logger.error('Yivi session failed:', startError);
			throw startError instanceof Error ? startError : new Error(`Yivi session failed: ${describeSessionFailure(startError)}`);
		});

	// Whichever comes first. `race` keeps a handler on both, so the core rejecting after the session
	// was stopped - which has already settled the result - does not go unhandled.
	return { session, result: Promise.race([started, stoppedResult]) };
};

export { canOpenYiviApp, startYiviAuthentication };
export type { YiviMountPoint, YiviSession };
