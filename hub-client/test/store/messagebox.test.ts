// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Stores
import { Message, MessageBoxType, MessageType, NATIVE_SHELL_ORIGINS, iframeHubId, useMessageBox } from '@hub-client/stores/messagebox';

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
});
