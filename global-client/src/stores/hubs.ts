// Packages
import { assert } from 'chai';
import { defineStore } from 'pinia';
import { RouteParams } from 'vue-router';

// Models
import { Hub, HubList } from '@global-client/models/Hubs';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useToggleMenu } from '@global-client/stores/toggleGlobalMenu';

import { Message, MessageType, iframeHubId, miniClientId, useMessageBox } from '@hub-client/stores/messagebox';
import { useSettings } from '@hub-client/stores/settings';

// Other
import { setLanguage, setUpi18n } from '@hub-client/i18n';

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
				return values.find((hub) => hub.hubName === hubName)!.hubId;
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
			const self = this;

			const messagebox = useMessageBox();

			assert.isDefined(this.hubs[hubId], 'Current hub is not initialized');

			// Start conversation with hub frame and sync latest settings
			await messagebox.startCommunication(this.hubs[hubId].url, miniClientId + '_' + hubId);

			// Listen to sync unreadmessages
			messagebox.addCallback(miniClientId + '_' + hubId, MessageType.UnreadMessages, (message: Message) => {
				self.hubs[hubId].unreadMessages = message.content as number;
				if (self.hubs[hubId].unreadMessages > 0) {
					sendNotification(self.hubs[hubId].hubName);
				}
			});
		},

		async changeHub(params: RouteParams) {
			const hubName = params.name as string;
			const hubId = hubName === '' ? '' : this.hubId(hubName);
			const roomId = params.roomId as string;
			const toggleMenu = useToggleMenu();
			const messagebox = useMessageBox();
			const global = useGlobal();

			const previousHubId = this.currentHubId;
			this.currentHubId = hubId;

			// Only change to a Hub if there is a hubId given of a valid hub, otherwise return
			if (typeof hubId === 'undefined' || !this.currentHubExists) {
				this.currentHubId = '';
				messagebox.resetCurrentHub();
				// TODO: find a way router can be part of a store that TypeScript swallows.
				// @ts-ignore
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

				//Show bar both client and global-side so we always enter a hub with them and we start in the same state of the bar. Hub rooms should close the bar themselves.
				toggleMenu.showMenuAndSendToHub();

				// Send current settings
				const settings = useSettings();
				settings.sendSettings();

				// Add a callback for sending the hubinformation
				messagebox.addCallback(iframeHubId, MessageType.SendHubInformation, () => {
					// Send hub information
					messagebox.sendMessage(new Message(MessageType.HubInformation, { name: this.hub(hubId)!.hubName }), iframeHubId);
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
					const [baseUrl] = currentUrl.split('#');
					// preserve the current history state
					const currentState = history.state || {};
					window.history.replaceState({ ...currentState, roomId }, '', `${baseUrl}#/hub/${hubName}/${roomId}`);
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
					const { token, userId }: { token: string; userId: string } = JSON.parse(authInfoMessage.content);
					global.addAccessTokenAndUserID(this.currentHubId, token, userId);
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

export { useHubs };
