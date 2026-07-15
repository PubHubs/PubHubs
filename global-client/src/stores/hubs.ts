// Packages
import { assert } from 'chai';
import { defineStore } from 'pinia';
import { type RouteParams } from 'vue-router';

// Logic
import { type LocalStore } from '@global-client/logic/utils/localStore';

import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { Hub, type HubList } from '@global-client/models/Hubs';

import { type MenuItem } from '@hub-client/models/components/contextMenu.models';
import { QueryParameterKey } from '@hub-client/models/constants';
import type { UnreadState } from '@hub-client/models/rooms/TBaseRoom';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useLocalStores } from '@global-client/stores/localStores';
import { useToggleMenu } from '@global-client/stores/toggleGlobalMenu';

import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
import { Message, MessageType, iframeHubId, miniClientId, useMessageBox } from '@hub-client/stores/messagebox';
import { useSettings } from '@hub-client/stores/settings';

// Other
import { setLanguage, setUpi18n } from '@hub-client/i18n';

const logger = createLogger('hubs');

/**
 * Last-known aggregate unread state per hub, as pushed by whichever hub
 * iframe was most recently the globally active one. Used to replay the
 * state to a miniclient that has just entered Linked mode (either because
 * its iframe just mounted and completed its handshake, or because its hub
 * just became the active one) — this avoids a window where the miniclient
 * would display 'unknown' until the next organic AggregateUnreadState
 * comes through.
 */
const lastUnreadStatePerHub = new Map<string, UnreadState>();

const useHubs = defineStore('hubs', {
	state: () => {
		return {
			currentHubId: '' as string,
			currentRoomId: '' as string,
			hubs: {} as { [index: string]: Hub },
		};
	},

	getters: {
		hubsArray(state): HubList {
			const values = Object.values(state.hubs);
			const hubs = values.filter((item) => typeof item?.hubId !== 'undefined');
			return hubs;
		},

		sortedHubsArray(): HubList {
			const hubs: HubList = Object.assign([], this.hubsArray);
			hubs.sort((a, b) => (a.description > b.description ? 1 : -1));
			return hubs;
		},

		activeHubs(): HubList {
			const hubs = this.sortedHubsArray;
			const nonActiveHubs = ['Surfhubs', 'GreenHost', 'GroenLinks', 'Waag'];
			return hubs.filter((hub) => !nonActiveHubs.includes(hub.hubName));
		},

		hasHubs() {
			return this.hubsArray.length > 0;
		},

		hubId: (state) => {
			return (hubName: string) => {
				const values = Object.values(state.hubs);
				return values.find((hub) => hub.hubName === hubName)?.hubId;
			};
		},

		hubExists: (state) => {
			return (hubId: string) => {
				return typeof state.hubs[hubId] === 'undefined' ? false : true;
			};
		},

		hub: (state) => {
			return (hubId: string) => {
				if (typeof state.hubs[hubId] !== 'undefined') {
					return state.hubs[hubId];
				}
				return undefined;
			};
		},

		currentHub(state): Hub | undefined {
			return state.hubs[state.currentHubId];
		},

		currentHubExists(state): boolean {
			return this.hubExists(state.currentHubId);
		},

		serverUrl(state): (hubId: string) => string | undefined {
			return (hubId: string) => {
				return state.hubs[hubId].serverUrl;
			};
		},
	},

	actions: {
		async addHub(hub: Hub) {
			this.hubs[hub.hubId] = Object.assign(new Hub(hub.hubId, hub.hubName, hub.url, hub.serverUrl), hub);
		},

		addHubs(hubs: HubList) {
			hubs.forEach((hub: Hub) => {
				this.addHub(hub);
			});
		},

		async setupMiniclient(hubId: string) {
			const messagebox = useMessageBox();
			const frameId = miniClientId + '_' + hubId;

			assert.isDefined(this.hubs[hubId], 'Current hub is not initialized');

			// Start conversation with hub frame and sync latest settings
			await messagebox.startCommunication(this.hubs[hubId].url, frameId);

			// Hub client signals when it transitions to having unread messages
			messagebox.addCallback(frameId, MessageType.UnreadMessages, () => {
				sendNotification(this.hubs[hubId].hubName);
			});

			// Per-miniclient frameId encodes the hubId, so it's a constant for the
			// lifetime of this iframe — no race with hub switches.
			attachLocalStoreHandlers(messagebox, frameId, () => hubId);

			// Tell this fresh miniclient whether its hub is the globally active
			// one. If yes it will render MiniclientLinked (no own sync) and
			// we replay the last known aggregate state so the badge appears
			// immediately rather than after the next organic update.
			const active = this.currentHubId === hubId;
			messagebox.sendMessage(new Message(MessageType.HubActive, { active }), frameId);
			if (active) replayLastUnreadState(messagebox, frameId, hubId);
		},

		async changeHub(params: RouteParams) {
			const hubName = params.name as string;
			const hubId = hubName === '' ? '' : (this.hubId(hubName) ?? '');
			const roomId = params.roomId as string;
			const toggleMenu = useToggleMenu();
			const messagebox = useMessageBox();
			const global = useGlobal();

			const previousHubId = this.currentHubId;
			this.currentHubId = hubId;

			// If we are moving away from a previously-active hub (either to a
			// different hub or to no hub at all), tell its miniclient it is no
			// longer the globally active one so it goes back to running its
			// own sync. When the hub is unchanged (same-hub room navigation)
			// this is a no-op.
			if (previousHubId && previousHubId !== hubId) {
				messagebox.sendMessage(new Message(MessageType.HubActive, { active: false }), miniClientId + '_' + previousHubId);
			}

			// If the target is not a valid hub, reset currentHubId to '' and
			// navigate the global client to home. This is still a hub change
			// (from whatever we were on to "no hub"), so the HubActive(false)
			// above for the previous hub is correct and we return afterwards.
			if (typeof hubId === 'undefined' || !this.currentHubExists) {
				this.currentHubId = '';
				messagebox.resetCurrentHub();
				// TODO: find a way router can be part of a store that TypeScript swallows.
				// @ts-expect-error -- router is injected as plugin, not in store type
				this.router.push({ name: 'home' });
				return;
			}

			// If Hub is not pinned yet (first time) -> Add it to the pinned Hubs
			if (!global.existsInPinnedHubs(this.currentHubId)) {
				assert.isDefined(this.currentHub, 'Current hub is not initialized');
				global.addPinnedHub(this.currentHub, 0);
			}

			// if the hub has not changed: check if the room has changed and if necessary sent message
			if (previousHubId === this.currentHubId) {
				// Let hub navigate to given room (if loggedIn)
				if (global.loggedIn && roomId !== undefined && roomId !== '') {
					this.currentRoomId = roomId;
					messagebox.sendMessage(new Message(MessageType.RoomChange, roomId), iframeHubId);
				}
			} else {
				//The hub has changed: set it up
				assert.isDefined(this.currentHub, 'Current hub is not initialized');

				// Start conversation with hub frame and sync latest settings
				await messagebox.startCommunication(this.currentHub.url, iframeHubId);

				// The main hub iframe reuses iframeHubId across hubs — read currentHubId
				// at message-arrival time so callbacks always use the current hub.
				attachLocalStoreHandlers(messagebox, iframeHubId, () => this.currentHubId || undefined);

				// Forward AggregateUnreadState from the active hub client to
				// its miniclient, updating the per-hub buffer on the way. The
				// hubId check in the payload guards against messages arriving
				// in-flight from a previous iframe instance.
				messagebox.addCallback(iframeHubId, MessageType.AggregateUnreadState, (message: Message) => {
					const content = message.content as { hubId?: string; state?: UnreadState };
					if (!content.hubId || content.state === undefined) return;
					if (content.hubId !== this.currentHubId) {
						logger.warn(`AggregateUnreadState: hubId mismatch (expected ${this.currentHubId}, got ${content.hubId}); dropping`);
						return;
					}
					lastUnreadStatePerHub.set(content.hubId, content.state);
					messagebox.sendMessage(
						new Message(MessageType.AggregateUnreadState, { hubId: content.hubId, state: content.state }),
						miniClientId + '_' + content.hubId,
					);
				});

				// Tell the new hub's miniclient that it is now the active one
				// so it switches to MiniclientLinked, and replay the last
				// known aggregate state so the badge renders immediately.
				const newMiniclientFrameId = miniClientId + '_' + hubId;
				messagebox.sendMessage(new Message(MessageType.HubActive, { active: true }), newMiniclientFrameId);
				replayLastUnreadState(messagebox, newMiniclientFrameId, hubId);

				//Show bar both client and global-side so we always enter a hub with them and we start in the same state of the bar. Hub rooms should close the bar themselves.
				toggleMenu.showMenuAndSendToHub();

				// Send current settings
				const settings = useSettings();
				settings.sendSettings();

				// Add a callback for sending the hubinformation
				messagebox.addCallback(iframeHubId, MessageType.SendHubInformation, () => {
					// Send hub information
					messagebox.sendMessage(new Message(MessageType.HubInformation, { name: this.hub(hubId)?.hubName }), iframeHubId);
					// Let hub navigate to given room (if loggedIn)
					if (global.loggedIn && roomId !== undefined && roomId !== '') {
						messagebox.sendMessage(new Message(MessageType.RoomChange, roomId), iframeHubId);
					}
				});

				// Listen to room change: only change url without reloading
				// Because this is the callback that sets the URL from the iFrame
				messagebox.addCallback(iframeHubId, MessageType.RoomChange, (message: Message) => {
					const roomId = message.content;
					const currentUrl = window.location.href;

					// Query parameter
					if (currentUrl.includes('?') && currentUrl.includes(QueryParameterKey.EventId)) {
						messagebox.sendMessage(new Message(MessageType.EventChange, currentUrl), iframeHubId);
					}

					const [baseUrl] = currentUrl.split('#');
					const newUrl = `${baseUrl}#/hub/${hubName}/${roomId}`;
					// Pass null as state to avoid corrupting Vue Router's internal history.state.
					// Not to keep the state current path.
					window.history.replaceState(null, '', newUrl);
				});

				//Listen to global menu change and don't resend own state.
				messagebox.addCallback(iframeHubId, MessageType.BarHide, () => {
					toggleMenu.globalIsActive = false;
				});

				messagebox.addCallback(iframeHubId, MessageType.BarShow, () => {
					toggleMenu.globalIsActive = true;
				});

				// Listen to modal show/hide
				messagebox.addCallback(iframeHubId, MessageType.DialogShowModal, () => {
					global.showModal();
				});
				messagebox.addCallback(iframeHubId, MessageType.DialogHideModal, () => {
					global.hideModal();
				});

				// Store and remove access tokens when sent from the hub client
				messagebox.addCallback(iframeHubId, MessageType.AddAuthInfo, (authInfoMessage: Message) => {
					const { token, userId }: { token: string; userId: string } = JSON.parse(authInfoMessage.content as string);
					global.addAccessTokenAndUserID(this.currentHubId, token, userId);
				});

				// Open context menu in global-client
				messagebox.addCallback(iframeHubId, MessageType.ContextMenuOpen, (message: Message) => {
					const { items, x, y, targetId } = message.content as { items: Record<string, unknown>[]; x: number; y: number; targetId: string };
					const contextMenu = useContextMenuStore();
					contextMenu.open(
						items.map((item: Record<string, unknown>, index: number) => ({
							...item,
							onClick: () => messagebox.sendMessage(new Message(MessageType.ContextMenuSelect, index), iframeHubId),
						})) as MenuItem[],
						x,
						y,
						targetId,
					);
				});

				messagebox.addCallback(iframeHubId, MessageType.RemoveAccessToken, () => {
					global.removeAccessToken(this.currentHubId);
					// So far this message is not yet used but the hub clients.
					// This will happen if the client says it's unhappy with its' token so refresh the page to reflect current state.
					location.reload();
				});
			}
		},
	},
});

function sendNotification(hubName: string) {
	const img = '/client/img/icons/favicon-32x32.png';
	const i18n = setUpi18n();
	const language = useSettings().language;
	setLanguage(i18n, language);
	const { t } = i18n.global;
	new Notification(t('message.notification'), {
		body: hubName,
		icon: img,
		badge: img,
	});
}

/**
 * Replay the last-known aggregate unread state for `hubId` to the given
 * miniclient frame, if we have one. Used right after telling a miniclient it
 * just became linked, so its badge reflects the cached state immediately
 * rather than waiting for the next organic AggregateUnreadState from the
 * active hub client.
 */
function replayLastUnreadState(messagebox: ReturnType<typeof useMessageBox>, miniclientFrameId: string, hubId: string): void {
	const state = lastUnreadStatePerHub.get(hubId);
	if (state === undefined) return;
	messagebox.sendMessage(new Message(MessageType.AggregateUnreadState, { hubId, state }), miniclientFrameId);
}

/**
 * Register the LocalStore message handlers for a hub iframe (main or
 * miniclient). Each handler cross-checks the hubId claimed in the message
 * payload against the trusted hubId from getExpectedHubId() — on mismatch
 * the message is dropped with a warning. This guards against in-flight
 * messages from a previous hub iframe instance arriving at the new iframe's
 * callbacks.
 */
function attachLocalStoreHandlers(messagebox: ReturnType<typeof useMessageBox>, frameId: string, getExpectedHubId: () => string | undefined): void {
	messagebox.addCallback(frameId, MessageType.LocalStoreLoad, async (message: Message) => {
		const store = await resolveVerifiedStore(message, getExpectedHubId, 'LocalStoreLoad');
		if (!store) return;
		const all = await store.getAll();
		messagebox.sendMessage(new Message(MessageType.LocalStoreLoaded, all), frameId);
	});

	messagebox.addCallback(frameId, MessageType.LocalStoreUpdate, async (message: Message) => {
		const store = await resolveVerifiedStore(message, getExpectedHubId, 'LocalStoreUpdate');
		if (!store) return;
		const content = message.content as { key?: string; value?: string };
		if (content.key === undefined || content.value === undefined) return;
		await store.set(content.key, content.value);
	});
}

/**
 * Verify that a LocalStore message's claimed hubId matches the expected one,
 * then resolve the corresponding LocalStore. Returns null on mismatch (logged)
 * or when the user is logged out.
 */
async function resolveVerifiedStore(message: Message, getExpectedHubId: () => string | undefined, action: string): Promise<LocalStore | null> {
	const expectedHubId = getExpectedHubId();
	const claimedHubId = (message.content as { hubId?: string } | undefined)?.hubId;
	if (!expectedHubId || claimedHubId !== expectedHubId) {
		logger.warn(`${action}: hubId mismatch (expected ${expectedHubId}, got ${claimedHubId}); dropping`);
		return null;
	}
	const localStores = await useLocalStores().retrieve();
	if (!localStores) return null;
	return await localStores.getOrCreate(expectedHubId);
}

export { useHubs };
