// Packages
import { Capacitor } from '@capacitor/core';

/**
 * Review mode lets app store reviewers log in to a separate environment with Yivi demo credentials, as
 * they can't use a real Yivi identity. Release builds name that environment's PHC in
 * `_env.REVIEW_PHC_URL`; client-config.production.js switches `_env.PHC_URL` to it while this key is
 * set. Reviewers turn it on by tapping the mascot on the login page ten times.
 */
const REVIEW_MODE_KEY = 'ph:review-mode';

// What ties this device to an account and hub list in one environment, so it must not be carried over
// to the other one.
const SESSION_KEYS = ['PHauthToken', 'UserSecret', 'UserSecretVersion', 'ph:hubs-cache'];

/** Whether this build can switch to the review environment at all: only the native app, with a review PHC configured. */
const reviewModeAvailable = (): boolean => Capacitor.isNativePlatform() && !!_env.REVIEW_PHC_URL;

/** Whether the app is talking to the review environment now. */
const inReviewMode = (): boolean => !!_env.REVIEW_PHC_URL && _env.PHC_URL === _env.REVIEW_PHC_URL;

/**
 * Switches to or from the review environment, and reloads on `path`: `_env` is read when the modules
 * load, so the other environment only takes effect after a reload.
 */
const switchReviewMode = (on: boolean, path: string): void => {
	if (on) {
		localStorage.setItem(REVIEW_MODE_KEY, '1');
	} else {
		localStorage.removeItem(REVIEW_MODE_KEY);
	}
	for (const key of SESSION_KEYS) {
		localStorage.removeItem(key);
	}
	window.location.hash = path;
	window.location.reload();
};

/**
 * Returns a tap handler that calls `onReached` on the `count`th tap in a row. A pause longer than
 * `maxGapMs` between two taps starts the count over.
 */
const createTapCounter = (count: number, maxGapMs: number, onReached: () => void): (() => void) => {
	let taps = 0;
	let lastTap = 0;
	return () => {
		const now = Date.now();
		taps = now - lastTap > maxGapMs ? 1 : taps + 1;
		lastTap = now;
		if (taps === count) {
			taps = 0;
			onReached();
		}
	};
};

export { createTapCounter, inReviewMode, REVIEW_MODE_KEY, reviewModeAvailable, switchReviewMode };
