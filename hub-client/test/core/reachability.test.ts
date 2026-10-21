import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { NetworkError } from '@hub-client/logic/core/networkError';
import {
	installOfflineSimulation,
	onReconnect,
	reachabilityOf,
	registerProbe,
	reportReachable,
	reportUnreachable,
	resetReachabilityForTests,
	trackedFetch,
	whenReachable,
} from '@hub-client/logic/core/reachability';

const HUB = 'https://hub.example';
const PHC = 'https://phc.example';

describe('reachability', () => {
	beforeEach(() => {
		resetReachabilityForTests();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	test('is tracked per origin', () => {
		expect(reachabilityOf(HUB)).toBe('unknown');
		reportUnreachable(`${HUB}/_matrix/client/versions`);
		reportReachable(`${PHC}/.ph/user/welcome`);
		expect(reachabilityOf(`${HUB}/anything`)).toBe('offline');
		expect(reachabilityOf(PHC)).toBe('online');
	});

	test('trackedFetch records answers and network errors, and rethrows the latter as NetworkError', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('no', { status: 500 })));
		await trackedFetch(`${HUB}/a`);
		expect(reachabilityOf(HUB)).toBe('online');

		vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch')));
		await expect(trackedFetch(`${HUB}/a`)).rejects.toBeInstanceOf(NetworkError);
		expect(reachabilityOf(HUB)).toBe('offline');
	});

	// A hub frame is removed when the user leaves the hub. Its requests then fail at once, and
	// matrix-js-sdk retries the push rules without any pause, which froze the whole app.
	test('trackedFetch leaves requests from a frame that is being unloaded pending', async () => {
		const fetch = vi.fn().mockResolvedValue(new Response('ok'));
		vi.stubGlobal('fetch', fetch);
		window.dispatchEvent(new Event('pagehide'));

		let settled = false;
		void trackedFetch(`${HUB}/a`).finally(() => (settled = true));
		await vi.runAllTimersAsync();
		expect(settled).toBe(false);
		expect(fetch).not.toHaveBeenCalled();

		window.dispatchEvent(new Event('pageshow'));
		await trackedFetch(`${HUB}/a`);
		expect(fetch).toHaveBeenCalledOnce();
	});

	test('trackedFetch rethrows an abort by the caller unchanged', async () => {
		const abort = new DOMException('aborted', 'AbortError');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(abort));
		await expect(trackedFetch(`${HUB}/a`)).rejects.toBe(abort);
		expect(reachabilityOf(HUB)).toBe('unknown');
	});

	test('probes an unreachable origin with backoff until it answers, then runs reconnect handlers once', async () => {
		const probe = vi.fn().mockRejectedValueOnce(new NetworkError(HUB)).mockResolvedValue(undefined);
		const handler = vi.fn();
		registerProbe(HUB, probe);
		onReconnect(HUB, handler);

		reportUnreachable(HUB);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(probe).toHaveBeenCalledTimes(1);
		expect(reachabilityOf(HUB)).toBe('offline');

		await vi.advanceTimersByTimeAsync(2_000);
		expect(probe).toHaveBeenCalledTimes(2);
		expect(reachabilityOf(HUB)).toBe('online');
		expect(handler).toHaveBeenCalledTimes(1);

		await vi.advanceTimersByTimeAsync(60_000);
		expect(probe).toHaveBeenCalledTimes(2);
	});

	test('a probe that gets an error answer counts as reachable', async () => {
		registerProbe(HUB, () => Promise.reject(new Error('M_FORBIDDEN')));
		reportUnreachable(HUB);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(reachabilityOf(HUB)).toBe('online');
	});

	test('reconnect handlers run in order, never overlapping, and once more when asked during a run', async () => {
		const calls: string[] = [];
		let finishFirst!: () => void;
		onReconnect(HUB, async () => {
			calls.push('settings');
			if (calls.length === 1) await new Promise<void>((resolve) => (finishFirst = resolve));
		});
		onReconnect(HUB, () => {
			calls.push('hubs');
		});

		reportUnreachable(HUB);
		reportReachable(HUB);
		reportUnreachable(HUB);
		reportReachable(HUB);
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toEqual(['settings']);

		finishFirst();
		await vi.advanceTimersByTimeAsync(0);
		expect(calls).toEqual(['settings', 'hubs', 'settings', 'hubs']);
	});

	test('a failing reconnect handler does not stop the next one', async () => {
		const next = vi.fn();
		onReconnect(HUB, () => Promise.reject(new Error('boom')));
		onReconnect(HUB, next);
		reportUnreachable(HUB);
		reportReachable(HUB);
		await vi.advanceTimersByTimeAsync(0);
		expect(next).toHaveBeenCalledTimes(1);
	});

	test('reaching an origin for the first time is not a reconnect', async () => {
		const handler = vi.fn();
		onReconnect(HUB, handler);
		reportReachable(HUB);
		await vi.advanceTimersByTimeAsync(0);
		expect(handler).not.toHaveBeenCalled();
	});

	test('the online event probes offline origins right away', async () => {
		const probe = vi.fn().mockResolvedValue(undefined);
		registerProbe(HUB, probe);
		reportUnreachable(HUB);
		window.dispatchEvent(new Event('online'));
		await vi.advanceTimersByTimeAsync(0);
		expect(probe).toHaveBeenCalledTimes(1);
		expect(reachabilityOf(HUB)).toBe('online');
	});

	test('the offline event marks every known origin offline', () => {
		reportReachable(HUB);
		reportReachable(PHC);
		window.dispatchEvent(new Event('offline'));
		expect(reachabilityOf(HUB)).toBe('offline');
		expect(reachabilityOf(PHC)).toBe('offline');
	});

	test('simulated offline fails requests to the chosen origins only', async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('ok'));
		vi.stubGlobal('fetch', fetchMock);
		installOfflineSimulation();

		window.pubhubsSimulateOffline!([`${PHC}/whatever`]);
		await expect(trackedFetch(`${PHC}/.ph/user/welcome`)).rejects.toBeInstanceOf(NetworkError);
		await trackedFetch(`${HUB}/a`);
		expect(fetchMock).toHaveBeenCalledTimes(1);

		window.pubhubsSimulateOffline!(false);
		await trackedFetch(`${PHC}/.ph/user/welcome`);
		expect(reachabilityOf(PHC)).toBe('online');
	});
});

describe('whenReachable', () => {
	beforeEach(() => {
		resetReachabilityForTests();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('resolves right away for a reachable origin', async () => {
		reportReachable(HUB);
		await expect(whenReachable(`${HUB}/x`)).resolves.toBeUndefined();
	});

	test('probes an origin nothing is known about, and resolves once it answers', async () => {
		const probe = vi.fn().mockResolvedValue(undefined);
		registerProbe(HUB, probe);
		const reached = vi.fn();
		void whenReachable(HUB).then(reached);
		await vi.advanceTimersByTimeAsync(0);
		expect(probe).toHaveBeenCalledTimes(1);
		expect(reached).toHaveBeenCalledTimes(1);
	});

	test('waits for an unreachable origin to come back', async () => {
		registerProbe(HUB, vi.fn().mockRejectedValueOnce(new NetworkError(HUB)).mockResolvedValue(undefined));
		reportUnreachable(HUB);
		const reached = vi.fn();
		void whenReachable(HUB).then(reached);
		await vi.advanceTimersByTimeAsync(1_000);
		expect(reached).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(2_000);
		expect(reached).toHaveBeenCalledTimes(1);
	});
});
