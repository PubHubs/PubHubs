import { defineStore } from 'pinia';

import { Optional } from 'matrix-events-sdk';
import { User as MatrixUser, MatrixClient, EventTimeline } from 'matrix-js-sdk';

import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';
import { useSettings, User, useUser, useRooms } from '@/store/store';

import { api } from '@/core/api';

const usePubHubs = defineStore('pubhubs', {
	state: () => {
		return {
			Auth: new Authentication(),
			client: {} as MatrixClient,
		};
	},

	getters: {
		getBaseUrl(state) {
			return state.Auth.getBaseUrl();
		},
	},

	actions: {
		centralLogin() {
			// @ts-ignore
			const centralLoginUrl = _env.PARENT_URL + '/login';
			window.top?.location.replace(centralLoginUrl);
		},

		async login() {
			console.log('PubHubs.login');
			try {
				const matrixClient = await this.Auth.login();
				this.client = matrixClient as MatrixClient;
				const events = new Events();
				events.startWithClient(this.client as MatrixClient);
				await events.initEvents();
				this.updateRooms();
				const user = useUser();
				const newUser = this.client.getUser(user.user.userId);
				if (newUser != null) {
					user.setUser(newUser as User);
					await user.fetchDisplayName(this.client as MatrixClient);
					await user.fetchIsAdministrator(this.client as MatrixClient);
					api.setAccessToken(this.Auth.getAccessToken());
				}
			} catch (error) {
				if (typeof error == 'string' && error.indexOf('M_FORBIDDEN') < 0) {
					console.debug('ERROR:', error);
				}
			}
		},

		logout() {
			this.Auth.logout();
		},

		updateLoggedInStatusBasedOnGlobalStatus(globalLoginTime: string) {
			this.Auth.updateLoggedInStatusBasedOnGlobalStatus(globalLoginTime);
		},

		async updateRooms() {
			console.log('PubHubs.updateRooms');
			const rooms = useRooms();
			const currentRooms = this.client.getRooms();
			rooms.updateRoomsWithMatrixRooms(currentRooms);
			await rooms.fetchPublicRooms();
		},

		/**
		 * Helpers
		 */

		showDialog(message: string) {
			alert(message);
		},

		showError(error: string) {
			const message = 'Unfortanatly an error occured. Please contact the developers.\n\n' + error;
			this.showDialog(message);
		},

		/**
		 * Wrapper methods for matrix client
		 */

		async getPublicRooms(search: string) {
			return await this.client.publicRooms({
				limit: 10,
				filter: {
					generic_search_term: search,
				},
			});
		},

		async getAllPublicRooms() {
			return await this.client.publicRooms({
				limit: 1000,
				filter: {
					generic_search_term: '',
				},
			});
		},

		async joinRoom(room_id: string) {
			await this.client.joinRoom(room_id);
			this.updateRooms();
		},

		async invite(room_id: string, user_id: string, reason = undefined) {
			await this.client.invite(room_id, user_id, reason);
		},

		async createRoom(options: object) {
			await this.client.createRoom(options);
			this.updateRooms();
		},

		async renameRoom(roomId: string, name: string) {
			await this.client.setRoomName(roomId, name);
			this.updateRooms();
		},

		async leaveRoom(roomId: string) {
			await this.client.leave(roomId);
		},

		addMessage(roomId: string, text: string) {
			const rooms = useRooms();
			const room = rooms.room(roomId);
			if (room) {
				if (room.isPrivateRoom()) {
					// (re)invite other members
					const notInvitedMembersIds = room.notInvitedMembersIdsOfPrivateRoom();
					if (notInvitedMembersIds.length > 0) {
						for (let index = 0; index < notInvitedMembersIds.length; index++) {
							const memberId = notInvitedMembersIds[index];
							this.invite(roomId, memberId);
						}
					}
				}
			}
			const content = {
				body: text,
				msgtype: 'm.text',
			};
			this.client.sendEvent(roomId, 'm.room.message', content, '');
		},

		addImage(roomId: string, uri: string) {
			this.client.sendImageMessage(roomId, uri);
		},

		async changeDisplayName(name: string) {
			try {
				this.client.setDisplayName(name);
			} catch (error) {
				this.showError(error as string);
			}
		},

		async getUsers(): Promise<Array<MatrixUser>> {
			const response = (await this.client.getUsers()) as [];
			return response;
		},

		async loadOlderEvents(roomId: string) {
			const self = this;
			return new Promise((resolve) => {
				const room = self.client.getRoom(roomId);
				if (room != null) {
					const firstEvent = room.timeline[0].event;
					if (firstEvent !== undefined && firstEvent.type !== 'm.room.create') {
						const timelineSet = room.getTimelineSets()[0];
						const eventId = firstEvent.event_id;
						if (eventId !== undefined) {
							self.client
								.getEventTimeline(timelineSet, eventId)
								.then((eventTimeline: Optional<EventTimeline>) => {
									if (eventTimeline) {
										const settings = useSettings();
										resolve(
											self.client.paginateEventTimeline(eventTimeline, {
												backwards: true,
												limit: settings.pagination,
											}),
										);
									} else {
										resolve(false);
									}
								})
								.catch((error: string) => {
									self.showError(error);
								});
						}
					} else {
						resolve(false);
					}
				} else {
					resolve(false);
				}
			});
		},
	},
});

export { usePubHubs };
