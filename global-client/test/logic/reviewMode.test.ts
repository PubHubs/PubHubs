// Packages
import { Capacitor } from '@capacitor/core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { createTapCounter, inReviewMode, REVIEW_MODE_KEY, reviewModeAvailable, switchReviewMode } from '@global-client/logic/reviewMode';

// The release config, as text: it's a plain script, not a module.
import productionConfig from '../../config/client-config.production.js?raw';

const REVIEW_PHC_URL = 'https://phc-review.example';
const env = _env;
const originalEnv = { ...env };

describe('review mode', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		Object.assign(env, originalEnv);
		delete env.REVIEW_PHC_URL;
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	test('is only available in the native app with a review PHC configured', () => {
		const native = vi.spyOn(Capacitor, 'isNativePlatform');

		native.mockReturnValue(true);
		expect(reviewModeAvailable()).toBe(false);

		env.REVIEW_PHC_URL = REVIEW_PHC_URL;
		expect(reviewModeAvailable()).toBe(true);

		native.mockReturnValue(false);
		expect(reviewModeAvailable()).toBe(false);
	});

	test('is on when the app talks to the review PHC', () => {
		env.REVIEW_PHC_URL = REVIEW_PHC_URL;
		expect(inReviewMode()).toBe(false);

		env.PHC_URL = REVIEW_PHC_URL;
		expect(inReviewMode()).toBe(true);
	});

	test('switching sets the key, drops the session and reloads on the given page', () => {
		const location = { hash: '', reload: vi.fn() };
		vi.stubGlobal('location', location);
		for (const key of ['PHauthToken', 'UserSecret', 'UserSecretVersion', 'ph:hubs-cache']) localStorage.setItem(key, 'x');
		localStorage.setItem('other', 'kept');

		switchReviewMode(true, '/register');
		expect(localStorage.getItem(REVIEW_MODE_KEY)).not.toBeNull();
		expect(localStorage.getItem('PHauthToken')).toBeNull();
		expect(localStorage.getItem('UserSecret')).toBeNull();
		expect(localStorage.getItem('UserSecretVersion')).toBeNull();
		expect(localStorage.getItem('ph:hubs-cache')).toBeNull();
		expect(localStorage.getItem('other')).toBe('kept');
		expect(location.hash).toBe('/register');
		expect(location.reload).toHaveBeenCalledTimes(1);

		switchReviewMode(false, '/login');
		expect(localStorage.getItem(REVIEW_MODE_KEY)).toBeNull();
		expect(location.hash).toBe('/login');
	});

	// The switch itself happens in the release config, before any module reads _env.
	test('the production config switches PHC_URL while the key is set', () => {
		const load = () => new Function(`${productionConfig}; return _env;`)() as typeof env;

		const normal = load();
		expect(normal.PHC_URL).not.toBe(normal.REVIEW_PHC_URL);

		localStorage.setItem(REVIEW_MODE_KEY, '1');
		const review = load();
		expect(review.PHC_URL).toBe(review.REVIEW_PHC_URL);
	});
});

describe('createTapCounter', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	const tap = (counter: () => void, times: number, gapMs: number) => {
		for (let i = 0; i < times; i++) {
			vi.advanceTimersByTime(gapMs);
			counter();
		}
	};

	test('fires on the given number of quick taps, and starts over after', () => {
		vi.useFakeTimers();
		const reached = vi.fn();
		const counter = createTapCounter(10, 1000, reached);

		tap(counter, 9, 200);
		expect(reached).not.toHaveBeenCalled();
		tap(counter, 1, 200);
		expect(reached).toHaveBeenCalledTimes(1);

		tap(counter, 9, 200);
		expect(reached).toHaveBeenCalledTimes(1);
	});

	test('a pause starts the count over', () => {
		vi.useFakeTimers();
		const reached = vi.fn();
		const counter = createTapCounter(10, 1000, reached);

		tap(counter, 9, 200);
		tap(counter, 1, 1500);
		tap(counter, 8, 200);
		expect(reached).not.toHaveBeenCalled();
		tap(counter, 1, 200);
		expect(reached).toHaveBeenCalledTimes(1);
	});
});
