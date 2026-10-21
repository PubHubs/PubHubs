// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Logic
import { isNativeHubOrigin } from '@hub-client/logic/utils/nativeHubOrigin';

// Stores
import { Message, MessageBoxType, MessageType, NATIVE_SHELL_ORIGINS, iframeHubId, useMessageBox } from '@hub-client/stores/messagebox';

// The tests run on localhost; some check how a hub-client behaves on its origin in the native app.
vi.mock('@hub-client/logic/utils/nativeHubOrigin', async (importOriginal) => ({
	...(await importOriginal<object>()),
	isNativeHubOrigin: vi.fn(() => false),
}));

const messages = [];
function mockTarget(id: string) {
	return {
		[id]: {
			window: {
				postMessage: (message: string, url: string) => {
					messages.push({ message: message, url: url });
				},
			},
			receiverUrl: 'http://child',
		},
	};
}

describe('MessageBox Store', () => {
	let messageboxParent = {} as useMessageBox;
	let messageboxChild = {} as useMessageBox;

	beforeEach(() => {
		vi.mocked(isNativeHubOrigin).mockReturnValue(false);
		setActivePinia(createPinia());
		messageboxParent = useMessageBox();
		messageboxChild = useMessageBox();
	});

	describe('idle', () => {
		test('default', () => {
			for (const id of messageboxParent.receiverUrlMap.keys()) {
				expect(messageboxParent.isReady(id)).toBe(false);
			}
			expect(messageboxParent.isConnected).toBe(false);
			for (const id of messageboxChild.receiverUrlMap.keys()) {
				expect(messageboxChild.isReady(id)).toBe(false);
			}
			expect(messageboxChild.isConnected).toBe(false);
			expect(messageboxChild.inIframe).toBe(false);
		});
	});

	describe('connect', () => {
		test('Parent', () => {
			const spyWindowAddEventListener = vi.spyOn(window, 'addEventListener');
			vi.stubGlobal('top', 'parent');
			vi.stubGlobal('self', 'parent');

			// init
			messageboxParent.init(MessageBoxType.Parent);
			messageboxParent.startCommunication('http://parent', iframeHubId);
			expect(spyWindowAddEventListener).toHaveBeenCalled();
			expect(window.top).toBe('parent');
			expect(window.self).toBe('parent');
			expect(messageboxParent.inIframe).toBe(false);
			expect(messageboxParent.isReady(iframeHubId)).toBe(false);

			// ready
			messageboxParent.type = MessageBoxType.Parent;
			messageboxParent.handshake = new Map<string, string>([[iframeHubId, 'ready']]);
			expect(messageboxParent.isReady(iframeHubId)).toBe(true);
			expect(messageboxParent.isConnected).toBe(true);

			// send message
			const message = new Message(MessageType.UnreadMessages);

			messageboxParent.resolveTarget = mockTarget;
			const spyResolveTarget = vi.spyOn(messageboxParent, 'resolveTarget');
			const currentMessagesLen = messages.length;
			messageboxParent.sendMessage(message, iframeHubId);
			expect(spyResolveTarget).toBeCalled();
			expect(messages.length).toBe(currentMessagesLen + 1);

			// Receive same message and test if callback works
			const callbackObj = {
				fake: () => {
					// console.log('FAKE CALLBACK');
				},
			};
			const spyOnCallback = vi.spyOn(callbackObj, 'fake');
			messageboxParent.addCallback(iframeHubId, MessageType.UnreadMessages, callbackObj.fake);
			expect(Object.keys(messageboxParent.callbacks.get(iframeHubId)).length).toBe(1);
			messageboxParent.receivedMessage(message, iframeHubId);
			expect(spyOnCallback).toBeCalledTimes(1);
		});

		test('Child', () => {
			const spyWindowAddEventListener = vi.spyOn(window, 'addEventListener');
			vi.stubGlobal('top', 'parent');
			vi.stubGlobal('self', 'child');

			messageboxChild.init(MessageBoxType.Child);
			messageboxChild.startCommunication('http://child');
			expect(spyWindowAddEventListener).toHaveBeenCalled();
			expect(window.top).toBe('parent');
			expect(window.self).toBe('child');
			expect(messageboxChild.inIframe).toBe(true);
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
			expect(messageboxChild.handshake.get('parentFrame')).toBe('started');
		});
	});

	// Regression tests for the native-shell origin check in `startCommunication`'s message listener:
	// a CHILD (hub-client) must trust its configured PARENT_URL and the official native-shell origins,
	// and nothing else — in particular, no longer the generic, spoofable 'http://localhost'.
	describe('native shell origin trust', () => {
		function dispatchSettingsReply(origin: string) {
			window.dispatchEvent(
				new MessageEvent('message', {
					origin,
					source: window,
					data: { type: MessageType.Settings, content: { theme: 'light', timeformat: '24', language: 'en' } },
				}),
			);
		}

		beforeEach(() => {
			vi.stubGlobal('top', 'parent');
			vi.stubGlobal('self', 'child');
			messageboxChild.init(MessageBoxType.Child);
			messageboxChild.startCommunication('https://configured-hub.example');
		});

		test('trusts the configured hub PARENT_URL origin', () => {
			dispatchSettingsReply('https://configured-hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
		});

		test.each(NATIVE_SHELL_ORIGINS)('trusts the configured native-shell origin %s', (origin) => {
			dispatchSettingsReply(origin);
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
			expect(messageboxChild.receiverUrlMap.get('parentFrame')).toBe(origin);
		});

		test('does not trust a generic http://localhost origin (regression guard: this used to stand in for the Android native shell)', () => {
			dispatchSettingsReply('http://localhost');
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		test('does not trust an arbitrary attacker-controlled origin', () => {
			dispatchSettingsReply('https://evil.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		test('does not trust a scheme mismatch on the native-shell hostname', () => {
			dispatchSettingsReply('http://pubhubs-app.invalid'); // right host, wrong scheme (neither iOS's 'capacitor://' nor Android's 'https://')
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		test('a PARENT never trusts a native-shell origin as a stand-in for its configured child URL', () => {
			vi.stubGlobal('self', 'parent');
			messageboxParent.init(MessageBoxType.Parent);
			messageboxParent.startCommunication('https://configured-hub.example', iframeHubId);

			window.dispatchEvent(
				new MessageEvent('message', {
					origin: NATIVE_SHELL_ORIGINS[0],
					data: { type: MessageType.Sync, content: '' },
				}),
			);
			expect(messageboxParent.isReady(iframeHubId)).toBe(false);
		});
	});

	// The native app has the child confirm the hub server url the parent expects, since a hub's origin does
	// not pin it down there. See startCommunication's hubServerUrl.
	describe('hub server url agreement', () => {
		const parentUrl = 'https://pubhubs-app.invalid';

		function dispatchSettingsReply(hubServerUrl?: string) {
			window.dispatchEvent(
				new MessageEvent('message', {
					origin: parentUrl,
					source: window,
					data: { type: MessageType.Settings, content: { theme: 'light', timeformat: '24', language: 'en', hubServerUrl } },
				}),
			);
		}

		beforeEach(() => {
			vi.stubGlobal('top', 'parent');
			vi.stubGlobal('self', 'child');
			messageboxChild.init(MessageBoxType.Child);
			messageboxChild.startCommunication(parentUrl, 'parentFrame', { hubServerUrl: 'https://hub.example/' });
		});

		test('completes when the parent expects the same server, ignoring a trailing slash', () => {
			dispatchSettingsReply('https://hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
		});

		test('completes when the parent does not check (web)', () => {
			dispatchSettingsReply(undefined);
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
		});

		test('refuses when the parent expects another server', () => {
			dispatchSettingsReply('https://evil.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		// A settings change is sent to every frame, and can reach one that is still in its handshake. In the
		// native app a hub's origin does not pin down its server, so only the handshake reply counts there.
		test('on a native hub origin, waits for a reply with the server url', () => {
			vi.mocked(isNativeHubOrigin).mockReturnValue(true);
			vi.stubGlobal('top', window);
			dispatchSettingsReply(undefined);
			expect(messageboxChild.isReady('parentFrame')).toBe(false);

			dispatchSettingsReply('https://hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
		});

		test('refuses when the child has no server url to compare', () => {
			messageboxChild.init(MessageBoxType.Child);
			messageboxChild.startCommunication(parentUrl);
			dispatchSettingsReply('https://hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		function startParent(options: Parameters<typeof messageboxParent.startCommunication>[2]) {
			vi.stubGlobal('self', 'parent');
			messageboxParent.init(MessageBoxType.Parent);
			const sent: { message: Message; url: string }[] = [];
			messageboxParent.resolveTarget = (id: string) => ({
				[id]: { window: { postMessage: (message: Message, url: string) => sent.push({ message, url }) }, receiverUrl: 'https://hub-origin.example' },
			});
			const handshake = messageboxParent.startCommunication('https://hub-origin.example', iframeHubId, options);
			return { sent, handshake };
		}

		function dispatchSync() {
			window.dispatchEvent(new MessageEvent('message', { origin: 'https://hub-origin.example', data: { type: MessageType.Sync, content: '' } }));
		}

		test('a parent sends the server url and storage key it was given along in its handshake reply', async () => {
			const { sent, handshake } = startParent({ hubServerUrl: 'https://hub.example', hubStorageKey: 'a2V5' });
			dispatchSync();

			expect(await handshake).toBe(true);
			expect(messageboxParent.isReady(iframeHubId)).toBe(true);
			expect(sent).toHaveLength(1);
			expect(sent[0].message.type).toBe(MessageType.Settings);
			expect((sent[0].message.content as { hubServerUrl?: string }).hubServerUrl).toBe('https://hub.example');
			expect((sent[0].message.content as { hubStorageKey?: string }).hubStorageKey).toBe('a2V5');
		});

		test('a parent listens before its options are ready, and answers once they are', async () => {
			let provide!: (options: { hubStorageKey: string }) => void;
			const { sent, handshake } = startParent(new Promise((resolve) => (provide = resolve)));
			dispatchSync();
			await Promise.resolve();
			expect(sent).toHaveLength(0);

			provide({ hubStorageKey: 'bGF0ZQ==' });
			expect(await handshake).toBe(true);
			expect((sent[0].message.content as { hubStorageKey?: string }).hubStorageKey).toBe('bGF0ZQ==');
		});

		test('a parent does not answer a handshake that was abandoned while its options were prepared', async () => {
			let provide!: (options: object) => void;
			const { sent, handshake } = startParent(new Promise((resolve) => (provide = resolve)));
			dispatchSync();
			messageboxParent.resetCurrentHub();

			provide({});
			expect(await handshake).toBe(false);
			await new Promise((resolve) => setTimeout(resolve));
			expect(sent).toHaveLength(0);
			expect(messageboxParent.isReady(iframeHubId)).toBe(false);
		});
	});

	// In the native app PARENT_URL comes in through the iframe's query string, which whoever embeds the
	// frame chooses: another hub's frame could embed this hub's origin and name itself as the parent.
	describe('the parent of a hub-client', () => {
		function dispatchSettingsReply(origin: string, source: MessageEventSource | null = window) {
			window.dispatchEvent(
				new MessageEvent('message', {
					origin,
					source,
					data: { type: MessageType.Settings, content: { theme: 'light', timeformat: '24', language: 'en', hubServerUrl: 'https://hub.example' } },
				}),
			);
		}

		function startChild(configuredParentUrl: string) {
			vi.stubGlobal('top', window);
			vi.stubGlobal('self', 'child');
			messageboxChild.init(MessageBoxType.Child);
			void messageboxChild.startCommunication(configuredParentUrl, 'parentFrame', { hubServerUrl: 'https://hub.example' });
		}

		test('on a native hub origin, is never the configured PARENT_URL, nor is anything sent there', () => {
			vi.mocked(isNativeHubOrigin).mockReturnValue(true);
			const postMessage = vi.spyOn(window, 'postMessage');
			startChild('https://other-hub.example');
			expect(postMessage.mock.calls.map((call) => call[1])).toEqual(['*']);

			messageboxChild.sendMessage(new Message(MessageType.AddAuthInfo, { token: 'secret' }));
			expect(postMessage).toHaveBeenCalledTimes(1);

			dispatchSettingsReply('https://other-hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(false);
		});

		test('on a native hub origin, is the app only when the hub frame sits directly in it', () => {
			vi.mocked(isNativeHubOrigin).mockReturnValue(true);
			startChild('https://other-hub.example');
			vi.stubGlobal('top', 'someone-else');
			dispatchSettingsReply(NATIVE_SHELL_ORIGINS[1]);
			expect(messageboxChild.isReady('parentFrame')).toBe(false);

			vi.stubGlobal('top', window);
			dispatchSettingsReply(NATIVE_SHELL_ORIGINS[1]);
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
		});

		test('is the parent window, not another window on the right origin', () => {
			startChild('https://configured-hub.example');
			const other = document.createElement('iframe');
			document.body.append(other);
			dispatchSettingsReply('https://configured-hub.example', other.contentWindow);
			expect(messageboxChild.isReady('parentFrame')).toBe(false);

			dispatchSettingsReply('https://configured-hub.example');
			expect(messageboxChild.isReady('parentFrame')).toBe(true);
			other.remove();
		});
	});

	// The main hub iframe keeps its id when the user switches hubs. The new hub's frame must not reach
	// what was set up for the previous hub (its callbacks answer with that hub's name and room).
	describe('switching hubs in the same frame', () => {
		test('a parent starts a new handshake on the id without the previous one being ready or its callbacks', async () => {
			vi.stubGlobal('self', 'parent');
			messageboxParent.init(MessageBoxType.Parent);
			messageboxParent.resolveTarget = (id: string) => ({ [id]: { window: { postMessage: () => {} }, receiverUrl: 'https://hub-a.example' } });
			const hubA = messageboxParent.startCommunication('https://hub-a.example', iframeHubId);
			window.dispatchEvent(new MessageEvent('message', { origin: 'https://hub-a.example', data: { type: MessageType.Sync, content: '' } }));
			expect(await hubA).toBe(true);
			const callbackOfHubA = vi.fn();
			messageboxParent.addCallback(iframeHubId, MessageType.SendHubInformation, callbackOfHubA);

			void messageboxParent.startCommunication('https://hub-b.example', iframeHubId);
			expect(messageboxParent.isReady(iframeHubId)).toBe(false);
			window.dispatchEvent(new MessageEvent('message', { origin: 'https://hub-b.example', data: { type: MessageType.SendHubInformation, content: '' } }));
			expect(callbackOfHubA).not.toHaveBeenCalled();
		});
	});
});
