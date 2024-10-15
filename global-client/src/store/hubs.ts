import { defineStore } from 'pinia';
import { RouteParams } from 'vue-router';
import { Message, MessageBoxType, MessageType, useGlobal, useMessageBox, useSettings } from '@/store/store';
import { setLanguage, setUpi18n } from '@/i18n';
import { useToggleMenu } from '@/store/toggleGlobalMenu';

// Single Hub
class Hub {
	readonly hubId: string;
	readonly url: string;
	readonly serverUrl: string;
	description: string;
	logo: string;
	unreadMessages: number;

	constructor(hubId: string, url: string, serverUrl: string, description?: string) {
		this.hubId = hubId;
		this.url = url;
		this.serverUrl = serverUrl;
		if (typeof description !== 'undefined') {
			this.description = description;
		} else {
			this.description = hubId;
		}
		this.logo = '';
		this.unreadMessages = 0;
	}
}

// Array of Hubs
interface HubList extends Array<Hub> {}

const useHubs = defineStore('hubs', {
	state: () => {
		return {
			currentHubId: '' as string,
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
			return hubs.filter((hub) => !nonActiveHubs.includes(hub.hubId));
		},

		hasHubs() {
			return this.hubsArray.length > 0;
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

		currentHub(state): Hub {
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
		addHub(hub: Hub) {
			this.hubs[hub.hubId] = Object.assign(new Hub(hub.hubId, hub.url, hub.serverUrl), hub);
		},

		addHubs(hubs: HubList) {
			hubs.forEach((hub: Hub) => {
				this.addHub(hub);
			});
		},

		async changeHub(params: RouteParams) {
			const hubId = params.id as string;
			const roomId = params.roomId as string;
			const self = this;
			const toggleMenu = useToggleMenu();
			const messagebox = useMessageBox();

			// Only change to a Hub if there is a hubId given
			if (typeof hubId !== 'undefined') {
				// Test if changing to current hub (through url for example)
				if (hubId !== this.currentHubId || this.currentHubId === '') {
					this.currentHubId = hubId;

					if (this.currentHubExists) {
						// Start conversation with hub frame and sync latest settings
						await messagebox.init(MessageBoxType.Parent, this.currentHub.url);

						//Show bar both client and global-side so we always enter a hub with them and we start in the same state of the bar. Hub rooms should close the bar themselves.
						toggleMenu.showMenuAndSendToHub();

						// Send current settings
						const settings = useSettings();
						settings.sendSettings();

						// Send hub information
						messagebox.sendMessage(new Message(MessageType.HubInformation, { name: hubId }));

						// Let hub navigate to given room
						if (roomId !== undefined && roomId !== '') {
							messagebox.sendMessage(new Message(MessageType.RoomChange, roomId));
						}

						// Listen to room change
						messagebox.addCallback(MessageType.RoomChange, (message: Message) => {
							const roomId = message.content;
							// TODO: find a way router can be part of a store that TypeScript swallows.
							// @ts-ignore
							this.router.push({ name: 'hub', params: { id: hubId, roomId: roomId } });
						});

						//Listen to global menu change and don't resend own state.
						messagebox.addCallback(MessageType.BarHide, () => {
							toggleMenu.globalIsActive = false;
						});

						messagebox.addCallback(MessageType.BarShow, () => {
							toggleMenu.globalIsActive = true;
						});

						// Listen to sync unreadmessages
						messagebox.addCallback(MessageType.UnreadMessages, (message: Message) => {
							self.hubs[hubId].unreadMessages = message.content as number;
							if (self.hubs[hubId].unreadMessages > 0) {
								sendNotification(hubId);
							}
						});

						// Listen to modal show/hide
						messagebox.addCallback(MessageType.DialogShowModal, () => {
							const global = useGlobal();
							global.showModal();
						});
						messagebox.addCallback(MessageType.DialogHideModal, () => {
							const global = useGlobal();
							global.hideModal();
						});

						// Store and remove access tokens when send from the hub client
						messagebox.addCallback(MessageType.AddAccessToken, (accessTokenMessage: Message) => {
							localStorage.setItem(hubId + 'accessToken', accessTokenMessage.content as string);
						});
						messagebox.addCallback(MessageType.RemoveAccessToken, () => {
							localStorage.removeItem(hubId + 'accessToken');
							// So far this message is not yet used but the hub clients.
							// This will happen if the client says it's unhappy with its' token so refresh the page to reflect current state.
							location.reload();
						});
					}
				}
			} else {
				this.currentHubId = '';
				messagebox.reset();
			}
		},
	},
});

function sendNotification(hubId: string) {
	const img = '/client/img/icons/favicon-32x32.png';
	const i18n = setUpi18n();
	const language = useSettings().language;
	setLanguage(i18n, language);
	const { t } = i18n.global;
	new Notification(t('message.notification'), {
		body: hubId,
		icon: img,
		badge: img,
	});
}

export { Hub, HubList, useHubs };
