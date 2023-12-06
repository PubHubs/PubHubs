import { defineStore } from 'pinia';

import { Optional } from 'matrix-events-sdk';
import { User as MatrixUser, MatrixClient, EventTimeline, ContentHelpers, MatrixError, IStateEventWithRoomId } from 'matrix-js-sdk';

import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';
import { useSettings, User, useUser, useRooms, useConnection, PubHubsRoomType } from '@/store/store';

import { hasHtml, sanitizeHtml } from '@/core/sanitizer';
import { api_synapse, api_matrix } from '@/core/api';
import { M_MessageEvent, M_TextMessageEventContent } from '@/types/events';
import { YiviSigningSessionResult } from '@/lib/signedMessages';

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
				this.client = (await this.Auth.login()) as MatrixClient;
				const events = new Events(this.client as MatrixClient);
				await events.initEvents();
				const connection = useConnection();
				connection.on();
				this.updateRooms();
				const user = useUser();
				const newUser = this.client.getUser(user.user.userId);
				if (newUser != null) {
					user.setUser(newUser as User);
					await user.fetchDisplayName(this.client as MatrixClient);
					await user.fetchIsAdministrator(this.client as MatrixClient);
					api_synapse.setAccessToken(this.Auth.getAccessToken());
					api_matrix.setAccessToken(this.Auth.getAccessToken());
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

		async createRoom(options: object): Promise<{ room_id: string }> {
			const room = await this.client.createRoom(options);
			this.updateRooms();
			return room;
		},

		async createPrivateRoomWith(other: any): Promise<{ room_id: string } | null> {
			const user = useUser();
			const me = user.user as User;
			const memberIds = [me.userId, other.userId];
			const rooms = useRooms();
			let existingRoomId = rooms.privateRoomWithMembersExist(memberIds);

			// Try joining existing
			if (existingRoomId !== false) {
				try {
					await this.client.joinRoom(existingRoomId as string);
					return { room_id: existingRoomId as string };
				} catch (error) {
					existingRoomId = false;
				}
			}

			// If realy not exists, create new
			if (existingRoomId == false) {
				console.log('createRoom', existingRoomId);
				const room = await this.createRoom({
					name: `${me.userId},${other.userId}`,
					visibility: 'private',
					invite: [other.userId],
					is_direct: true,
					creation_content: { type: PubHubsRoomType.PH_MESSAGES_DM },
					topic: `PRIVATE: ${me.userId}, ${other.userId}`,
					history_visibility: 'shared',
					guest_can_join: false,
				});
				// Returns invalid user id - 400, when no such user. So nice
				return room;
			}
			return null;
		},

		async renameRoom(roomId: string, name: string) {
			await this.client.setRoomName(roomId, name);
			this.updateRooms();
		},

		async leaveRoom(roomId: string) {
			await this.client.leave(roomId);
			const rooms = useRooms();
			rooms.room(roomId)?.hide();
			// this.updateRooms();
		},

		_constructMessageContent(text: string): M_TextMessageEventContent {
			let content = ContentHelpers.makeTextMessage(text) as M_TextMessageEventContent;

			const cleanText = hasHtml(text);
			if (typeof cleanText == 'string') {
				const html = sanitizeHtml(text);
				content = ContentHelpers.makeHtmlMessage(cleanText, html) as M_TextMessageEventContent;
			}
			return content;
		},

		/**
		 * @param roomId
		 * @param text
		 * @param inReplyTo Possible event to which the new message replies.
		 */
		async addMessage(roomId: string, text: string, inReplyTo?: M_MessageEvent) {
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

			const content = this._constructMessageContent(text);

			if (content.body.includes('@')) {
				const users = await this.getUsers();
				let mentionedUsersName = [];
				const mentionedUsers = content.body.split('@');
				mentionedUsersName = users
					.filter((user) => {
						return mentionedUsers.some((menUser) => user.rawDisplayName != undefined && (menUser.includes(user.rawDisplayName) || menUser === user.rawDisplayName));
					})
					.map((users) => users.rawDisplayName)
					.filter((displayName): displayName is string => displayName !== undefined);

				// Assuming content is an instance of M_TextMessageEventContent
				if (!content['m.mentions']) {
					content['m.mentions'] = {};
				}
				content['m.mentions']['room'] = true;
				content['m.mentions']['user_ids'] = mentionedUsersName;
			}
			// If the message is a reply to another event.
			if (inReplyTo) {
				content['m.relates_to'] = { 'm.in_reply_to': { event_id: inReplyTo.event_id, x_event_copy: structuredClone(inReplyTo) } };

				delete content['m.relates_to']?.['m.in_reply_to']?.x_event_copy?.content?.['m.relates_to']?.['m.in_reply_to']?.x_event_copy;
			}
			try {
				await this.client.sendEvent(roomId, 'm.room.message', content, '');
			} catch (error) {
				console.log(error);
			}
		},

		async addSignedMessage(roomId: string, signedMessage: YiviSigningSessionResult) {
			const content = {
				msgtype: 'pubhubs.signed_message',
				body: 'signed message',
				signed_message: signedMessage,
			};
			await this.client.sendEvent(roomId, 'm.room.message', content);
		},

		async addImage(roomId: string, uri: string) {
			try {
				await this.client.sendImageMessage(roomId, uri);
			} catch (error) {
				console.log(error);
			}
		},

		async addFile(roomId: string, file: File, uri: string) {
			const content = {
				body: file.name,
				filename: file.name,
				info: {
					mimetype: file.type,
					size: file.size,
				},
				msgtype: 'm.file',
				url: uri,
			};
			try {
				await this.client.sendEvent(roomId, 'm.room.message', content);
			} catch (error) {
				console.log(error);
			}
		},

		async resendEvent(event: any) {
			const roomId = event.room_id;
			const type = event.type;
			const content = event.content;
			try {
				// Remove orginal event, to prevend double events
				const rooms = useRooms();
				rooms.currentRoom?.removeEvent(event.event_id);
				// Resend
				await this.client.sendEvent(roomId, type, content);
			} catch (error) {
				console.log(error);
			}
		},

		async changeDisplayName(name: string) {
			try {
				this.client.setDisplayName(name);
			} catch (error) {
				this.showError(error as string);
			}
		},

		async changeAvatar(uri: string) {
			try {
				await this.client.setAvatarUrl(uri);
				//Quickly update the avatar url.
				await this.client.sendStateEvent('', 'm.room.avatar', { uri }, '');
			} catch (error) {
				const e = error as MatrixError;
				// No user ist there on settings. so we ignore the error.
				if (e.errcode !== 'M_FORBIDDEN') {
					this.showError(error as string);
				}
			}
		},

		async getAvatarUrl() {
			const user = useUser();
			const url = await user.fetchAvatarUrl(this.client as MatrixClient);
			return url;
		},

		async findUsers(term: string): Promise<Array<any>> {
			const response = await this.client.searchUserDirectory({ term: term });
			return response.results;
		},

		async getUsers(): Promise<Array<MatrixUser>> {
			const response = (await this.client.getUsers()) as [];
			return response;
		},

		async getMembersOfRoom(room_id: string): Promise<{ [userId: string]: IStateEventWithRoomId[] }> {
			const response = await this.client.members(room_id);
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
