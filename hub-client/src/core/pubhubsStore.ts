import { defineStore } from 'pinia';

import { User as MatrixUser, MatrixClient, MatrixEvent, ContentHelpers, MatrixError, IStateEventWithRoomId } from 'matrix-js-sdk';

import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';
import { useSettings, User, useUser, useRooms, useConnection, PubHubsRoomType } from '@/store/store';

import filters from '@/core/filters';
import { hasHtml, sanitizeHtml } from '@/core/sanitizer';
import { api_synapse, api_matrix } from '@/core/api';
import { M_Mentions, M_MessageEvent, M_TextMessageEventContent } from '@/types/events';
import { YiviSigningSessionResult, AskDisclosureMessage } from '@/lib/signedMessages';
import { ReceiptType } from 'matrix-js-sdk/lib/@types/read_receipts';

const usePubHubs = defineStore('pubhubs', {
	state: () => ({
		Auth: new Authentication(),
		client: {} as MatrixClient,
	}),

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

		showError(error: string | MatrixError) {
			if (typeof error !== 'string') {
				if (error.errcode !== 'M_FORBIDDEN') {
					this.showDialog(error.data.error as string);
				} else {
					console.log(error);
				}
			} else {
				this.showDialog('Unfortanatly an error occured. Please contact the developers.\n\n' + error.toString);
			}
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
			let publicRoomsResponse = await this.client.publicRooms({
				limit: 1000,
				filter: {
					generic_search_term: '',
				},
			});
			let public_rooms = publicRoomsResponse.chunk;

			while (publicRoomsResponse.next_batch) {
				publicRoomsResponse = await this.client.publicRooms({
					limit: 1000,
					since: publicRoomsResponse.next_batch,
					filter: {
						generic_search_term: '',
					},
				});
				public_rooms = public_rooms.concat(publicRoomsResponse.chunk);
			}

			return public_rooms;
		},

		async joinRoom(room_id: string) {
			await this.client.joinRoom(room_id);
			this.updateRooms();
		},

		async invite(room_id: string, user_id: string, reason = undefined) {
			await this.client.invite(room_id, user_id, reason);
		},

		async createRoom(options: any): Promise<{ room_id: string }> {
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

		async setTopic(roomId: string, topic: string) {
			await this.client.setRoomTopic(roomId, topic);
			this.updateRooms();
		},

		async leaveRoom(roomId: string) {
			await this.client.leave(roomId);
			const rooms = useRooms();
			rooms.room(roomId)?.hide();
			// this.updateRooms();
		},

		/**
		 * Adds users which are mentioned by '@' in the message to m.mentions field, mutating the content argument.
		 */
		async _addUserMentionsToMessageContent(content: M_TextMessageEventContent) {
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

				content['m.mentions']['user_ids'] = content['m.mentions']['user_ids'].concat(mentionedUsersName);
			}
		},

		_createEmptyMentions(): M_Mentions {
			return {
				room: false,
				user_ids: [],
			};
		},

		/**
		 * Mutates the message content appropriately to become a reply to the inReplyTo event.
		 */
		_addInReplyToToMessageContent(content: M_TextMessageEventContent, inReplyTo: M_MessageEvent) {
			content['m.relates_to'] = { 'm.in_reply_to': { event_id: inReplyTo.event_id, x_event_copy: structuredClone(inReplyTo) } };

			// Don't save inReplyTo of inReplyTo event.
			delete content['m.relates_to']?.['m.in_reply_to']?.x_event_copy?.content?.['m.relates_to']?.['m.in_reply_to']?.x_event_copy;

			// Mention appropriate users

			if (
				inReplyTo.content.msgtype == 'm.text' &&
				// For backwards compatibility
				inReplyTo.content['m.mentions']
			) {
				const newUsers = [...inReplyTo.content['m.mentions'].user_ids, inReplyTo.sender];
				content['m.mentions'].user_ids.concat(newUsers);
			}
		},

		async _constructMessageContent(text: string, inReplyTo?: M_MessageEvent): Promise<M_TextMessageEventContent> {
			let content = ContentHelpers.makeTextMessage(text) as M_TextMessageEventContent;

			const cleanText = hasHtml(text);
			if (typeof cleanText == 'string') {
				const html = sanitizeHtml(text);
				content = ContentHelpers.makeHtmlMessage(cleanText, html) as M_TextMessageEventContent;
			}

			// content should have M_TextMessageEventContent type after this step (and not before), but don't know how to change type.
			content['m.mentions'] = this._createEmptyMentions();

			await this._addUserMentionsToMessageContent(content);

			// If the message is a reply to another event.
			if (inReplyTo) {
				this._addInReplyToToMessageContent(content, inReplyTo);
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

			const content = await this._constructMessageContent(text, inReplyTo);

			// ?Are we catching this for a reason?
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

		async sendReadReceipt(event: MatrixEvent) {
			if (!event) return;
			const loggedInUser = useUser();
			const content = {
				'm.read': {
					[loggedInUser.user.userId]: {
						ts: event.localTimestamp,
						thread_id: 'main',
					},
				},
			};
			await this.client.sendReceipt(event, ReceiptType.Read, content);
		},

		async addAskDisclosureMessage(roomId: string, body: string, askDisclosureMessage: AskDisclosureMessage) {
			const content = {
				msgtype: 'pubhubs.ask_disclosure_message',
				body: body,
				ask_disclosure_message: askDisclosureMessage,
			};
			await this.client.sendEvent(roomId, 'm.room.message', content);
		},

		// Sends acknowledgement to synapse about the message has been read.
		// We also store the timestamp in localstorage to avoid any inaccuracy of timestamp comparision.
		// SEE our algorithm for receipt acknowledgement in room.ts / unreadMessageCounter
		async sendAcknowledgementReceipt(userId: string) {
			const receiptTimeStamp = Date.now();
			const rooms = useRooms();
			const roomId = rooms.currentRoom?.roomId!;

			// If we already have unread messages in the room and we haven't seen them, then no need to send a receipt.
			if (rooms.currentRoom?._ph.unreadMessages != 0) {
				return;
			}

			const content = {
				'm.read': {
					[userId]: {
						ts: receiptTimeStamp,
						thread_id: undefined,
					},
				},
			};

			// Retrieve existing data from localStorage
			const storedDataString = localStorage.getItem('receiptTS');
			let storedData: { roomId: string; timestamp: number }[] = [];

			if (storedDataString) {
				try {
					storedData = JSON.parse(storedDataString);
				} catch (error) {
					console.error('Error parsing data from localStorage:', error);
				}
			}

			// Find the index of the existing entry based on roomId
			const existingIndex = storedData.findIndex((data) => data.roomId === roomId);

			if (existingIndex !== -1) {
				// Update the timestamp of the existing entry
				storedData[existingIndex].timestamp = receiptTimeStamp;
			} else {
				// If no existing entry found, add a new one
				const roomData = { roomId, timestamp: receiptTimeStamp };
				storedData.push(roomData);
			}

			// Save the updated data back to localStorage
			localStorage.setItem('receiptTS', JSON.stringify(storedData));
			try {
				await this.client.sendEvent(roomId, 'm.receipt', content);
			} catch (err) {
				console.log(err);
			}
		},

		async addImage(roomId: string, uri: string) {
			try {
				await this.client.sendImageMessage(roomId, uri, undefined);
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
				await this.client.setDisplayName(name);
			} catch (error: any) {
				this.showError(error);
			}
		},

		async changeAvatar(uri: string) {
			try {
				await this.client.setAvatarUrl(uri);
				//Quickly update the avatar url.
				await this.client.sendStateEvent('', 'm.room.avatar', { uri }, '');
			} catch (error: any) {
				this.showError(error);
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
			let users = (await this.client.getUsers()) as Array<MatrixUser>;
			// Doesn't get all displaynames correct from database, this is a hack to change displayName to only the pseudonym
			users = users.map((user) => {
				if (user.userId == user.displayName) {
					user.displayName = filters.extractPseudonym(user.userId);
				}
				return user;
			});
			return users;
		},

		async getMembersOfRoom(room_id: string): Promise<{ [userId: string]: IStateEventWithRoomId[] }> {
			const response = await this.client.members(room_id);
			return response;
		},

		/**
		 * Loads older events in a room.
		 *
		 * @returns {boolean} true if all events are loaded, false otherwise.
		 */
		async loadOlderEvents(roomId: string): Promise<boolean> {
			const settings = useSettings();

			const room = this.client.getRoom(roomId);
			const firstEvent = room?.getLiveTimeline().getEvents()[0];

			// If all messages are loaded, return.
			if (!firstEvent || firstEvent.getType() === 'm.room.create') return true;

			const timelineSet = room.getTimelineSets()[0];
			const eventId = firstEvent.getId();

			if (!eventId) throw new Error('Failed to load older events: EventId not found');

			const timeline = await this.client.getEventTimeline(timelineSet, eventId);
			if (!timeline) throw new Error('Failed to load older events: Timeline not found');

			await this.client.paginateEventTimeline(timeline, { backwards: true, limit: settings.pagination });
			return false;
		},

		async loadToMessage(roomId: string, eventId: string) {
			const room = this.client.getRoom(roomId);
			if (!room) throw new Error('Failed to load to message: Room not found');

			let eventTimeline = room.getTimelineForEvent(eventId);
			let i = 0;
			let allEventsLoaded = false;
			const searchLimit = 1000;

			while (!eventTimeline && !allEventsLoaded && i < searchLimit) {
				allEventsLoaded = await this.loadOlderEvents(roomId);
				eventTimeline = room.getTimelineForEvent(eventId);
				i++;
			}
		},
	},
});

export { usePubHubs };
