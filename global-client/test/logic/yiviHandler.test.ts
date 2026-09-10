// Packages
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';

// Logic
import { startYiviAuthentication } from '@global-client/logic/utils/yiviHandler';

// The Yivi core is replaced by a stand-in that records the options it was constructed with and hands
// the test control over when the session settles. Everything the handler does around it - resolving
// the mount point, aborting, turning a rejection into a message - is the real implementation.
const { cores } = vi.hoisted(() => ({ cores: [] as MockCore[] }));

type MockCore = {
	options: { element: string };
	abort: ReturnType<typeof vi.fn>;
	settle: { resolve: (value: unknown) => void; reject: (reason: unknown) => void };
};

vi.mock('@privacybydesign/yivi-core', () => ({
	YiviCore: class {
		public readonly options: { element: string };
		public readonly abort = vi.fn();
		public settle!: MockCore['settle'];

		constructor(options: { element: string }) {
			this.options = options;
			cores.push(this as unknown as MockCore);
		}

		use() {}

		start() {
			return new Promise((resolve, reject) => {
				this.settle = { resolve, reject };
			});
		}
	},
}));

const mountPointFor = (element: HTMLElement) => {
	document.body.append(element);
	return ref<HTMLElement | null>(element);
};

describe('Yivi handler', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		cores.length = 0;
	});

	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	describe('Choosing a mount point', () => {
		test('The widget is rendered into the element the mount point holds', () => {
			const element = document.createElement('div');

			startYiviAuthentication('http://yivi-test', 'request', mountPointFor(element));

			expect(document.querySelector(cores[0].options.element)).toBe(element);
		});

		test('Two mount points are given selectors of their own', () => {
			// The widget resolves its element with `document.querySelector`, so two mount points sharing
			// an id would both render into whichever comes first in the document.
			const first = document.createElement('div');
			const second = document.createElement('div');

			startYiviAuthentication('http://yivi-test', 'request', mountPointFor(first));
			startYiviAuthentication('http://yivi-test', 'request', mountPointFor(second));

			expect(cores[0].options.element).not.toEqual(cores[1].options.element);
			expect(document.querySelector(cores[0].options.element)).toBe(first);
			expect(document.querySelector(cores[1].options.element)).toBe(second);
		});

		test('An element keeps the id it already has', () => {
			const element = document.createElement('div');
			element.id = 'somewhere-of-its-own';

			startYiviAuthentication('http://yivi-test', 'request', mountPointFor(element));

			expect(cores[0].options.element).toBe('#somewhere-of-its-own');
		});

		test('The same element keeps its selector across sessions', () => {
			const element = document.createElement('div');
			const mountPoint = mountPointFor(element);

			startYiviAuthentication('http://yivi-test', 'request', mountPoint);
			startYiviAuthentication('http://yivi-test', 'request', mountPoint);

			expect(cores[0].options.element).toEqual(cores[1].options.element);
		});

		test('A mount point that holds nothing is reported instead of rendered into', () => {
			expect(() => startYiviAuthentication('http://yivi-test', 'request', ref(null))).toThrow(/no element/i);
			expect(cores).toHaveLength(0);
		});
	});

	describe('Ending a session', () => {
		test('The disclosure is fetched once the session succeeds', async () => {
			const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('the-jwt', { status: 200 }));

			const { result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			cores[0].settle.resolve({ token: 'session-token' });

			await expect(result).resolves.toBe('the-jwt');
			expect(fetchMock).toHaveBeenCalledWith('http://yivi-test/session/session-token/result-jwt');
		});

		test('Aborting stops the session and is not reported as a failure', async () => {
			const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { session, result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			session.abort();
			// The real core reaches its end state through the abort, which rejects the session.
			cores[0].settle.reject('Aborted');

			expect(cores[0].abort).toHaveBeenCalled();
			await expect(result).rejects.toThrow(/aborted/i);
			expect(errorLog).not.toHaveBeenCalled();
		});

		test('Aborting settles the result even when the core does nothing', async () => {
			// `YiviCore.abort()` is a no-op while the session is uninitialised or already in an end
			// state, so the core never reaches `start()`'s reject. A caller waiting on the result would
			// wait for good if the abort did not settle it itself.
			const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});

			const { session, result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			session.abort();

			await expect(result).rejects.toThrow(/aborted/i);
			expect(errorLog).not.toHaveBeenCalled();
		});

		test('A failure names the state the session ended in', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});

			const { result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			// `YiviCore` wraps the state name in an array as soon as a plugin returns something from its
			// `close()`, which `yivi-client` does.
			cores[0].settle.reject(['TimedOut', undefined, true]);

			await expect(result).rejects.toThrow('Yivi session failed: TimedOut');
		});

		test('A failure that carries no state does not become "[object Object]"', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});

			const { result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			cores[0].settle.reject({ status: 500 });

			await expect(result).rejects.toThrow('Yivi session failed: {"status":500}');
		});

		test('An error thrown while collecting the result is passed on as it is', async () => {
			vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no jwt for you', { status: 500 }));

			const { result } = startYiviAuthentication('http://yivi-test', 'request', mountPointFor(document.createElement('div')));
			cores[0].settle.resolve({ token: 'session-token' });

			await expect(result).rejects.toThrow('Could not retrieve the Yivi JWT: no jwt for you');
		});
	});
});
