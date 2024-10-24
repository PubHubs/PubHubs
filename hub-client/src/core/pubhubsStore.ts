import { defineStore } from 'pinia';

import { api_matrix, api_synapse } from '@/core/api';
import { Authentication } from '@/core/authentication';
import { Events } from '@/core/events';
import { createNewPrivateRoomName, fetchMemberIdsFromPrivateRoomName, refreshPrivateRoomName, updatePrivateRoomName } from '@/core/privateRoomNames';
import { hasHtml, sanitizeHtml } from '@/core/sanitizer';
import { AskDisclosureMessage, YiviSigningSessionResult } from '@/lib/signedMessages';
import { TMentions, TMessageEvent, TTextMessageEventContent } from '@/model/events/TMessageEvent';
import { TSearchParameters } from '@/model/model';
import Room from '@/model/rooms/Room';
import { RoomType, TPublicRoom, useConnection, User, useRooms, useUser } from '@/store/store';
import { ContentHelpers, ISearchResults, MatrixClient, MatrixError, MatrixEvent, Room as MatrixRoom, User as MatrixUser, MsgType } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk/lib/@types/read_receipts';
import { router } from './router';
import { Logger } from '@/dev/Logger';
import { SMI } from '@/dev/StatusMessage';

let publicRoomsLoading: Promise<any> | null = null; // outside of defineStore to guarantee lifetime, not accessible outside this module

const usePubHubs = defineStore('pubhubs', {
	state: () => ({
		Auth: new Authentication(),
		client: {} as MatrixClient,
		publicRooms: [] as TPublicRoom[],
		lastPublicCheck: 0,
		logger: new Logger('pubhubs store'),
	}),

	getters: {
		getBaseUrl(state) {
			return state.Auth.getBaseUrl();
		},
	},

	actions: {
		centralLogin() {
			// @ts-ignore
			const centralLoginUrl = _env.PARENT_URL + '/client';
			window.top?.location.replace(centralLoginUrl);
		},

		async login() {
			this.logger.log(SMI.STARTUP_TRACE, 'START PubHubs.login');
			this.Auth.login()
				.then((x) => {
					this.logger.log(SMI.STARTUP_TRACE, 'PubHubs.logged in (X) - started client');
					this.client = x as MatrixClient;
					const events = new Events(this.client as MatrixClient);
					events.initEvents();
				})
				.then(async () => {
					this.logger.log(SMI.STARTUP_TRACE, 'PubHubs.logged in ()');
					const connection = useConnection();
					connection.on();
					const user = useUser();
					const newUser = this.client.getUser(user.user.userId);

					if (newUser !== null) {
						user.setUser(newUser as User);
						api_synapse.setAccessToken(this.Auth.getAccessToken()!); //Since user isn't null, we expect there to be an access token.
						api_matrix.setAccessToken(this.Auth.getAccessToken()!);
						user.fetchIsAdministrator(this.client as MatrixClient);
						const avatarUrl = await this.client.getProfileInfo(newUser.userId, 'avatar_url');
						if (avatarUrl.avatar_url !== undefined) user.avatarUrl = avatarUrl.avatar_url;
						this.updateRooms();
					}
				})
				.catch((error) => {
					this.logger.log(SMI.STARTUP_TRACE, 'Something went wrong while creating a matrix-js client instance or logging in', error);
					router.push({ name: 'error-page' });
				});
		},

		logout() {
			this.Auth.logout();
		},

		// Will check with the homeserver for changes in joined rooms and update the local situation to reflect that.
		async updateRooms() {
			const rooms = useRooms();

			const joinedRooms = (await this.client.getJoinedRooms()).joined_rooms; //Actually makes an HTTP request to the Hub server.
			let knownRooms = this.client.getRooms();
			// Make sure the metrix js SDK client is aware of all the rooms the user has joined
			for (const room_id of joinedRooms) {
				if (!knownRooms.find((kr) => kr.roomId === room_id)) {
					const room = await this.client.joinRoom(room_id);
					this.client.store.storeRoom(room);
				}
			}

			knownRooms = this.client.getRooms();

			const currentRooms = knownRooms.filter((room) => joinedRooms.indexOf(room.roomId) !== -1);
			this.logger.log(SMI.STORE_TRACE, 'PubHubs.updateRooms');
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
					this.logger.log(SMI.STORE_TRACE, 'showing error dialog', error);
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

		// wrapping API call to publicRooms, so it does not get called again when in progress.
		// Both login and DiscoverRooms called this method which in some cases lead to slowing the process.
		// Now we make sure the API is called just once, returning the result to all possible callers.
		async getAllPublicRooms(): Promise<TPublicRoom[]> {
			// if promise already running: return promise
			if (publicRoomsLoading) {
				return publicRoomsLoading;
			}

			// create promise
			publicRoomsLoading = new Promise<TPublicRoom[]>((resolve, reject) => {
				try {
					resolve(this.performGetAllPublicRooms());
				} catch (error) {
					reject(error);
				}
			}).then((x) => {
				publicRoomsLoading = null;
				return x;
			});

			// return promise
			return publicRoomsLoading;
		},

		// actual performing of publicRooms API call
		async performGetAllPublicRooms(): Promise<TPublicRoom[]> {
			if (!this.client.publicRooms) {
				return [];
			}
			if (Date.now() < this.lastPublicCheck + 2_500) {
				//Only check again after 4 seconds.
				return this.publicRooms;
			}

			let publicRoomsResponse = await this.client.publicRooms();
			let public_rooms = publicRoomsResponse.chunk;

			// DANGER this while loop turns infinite when the generated public rooms request is a POST request.
			// this happens when the optional 'options' parameter is supplied to 'this.client.publicRooms'. Then the
			// pagination doesn't work anymore and the loop becomes infinite.
			while (publicRoomsResponse.next_batch) {
				publicRoomsResponse = await this.client.publicRooms({
					since: publicRoomsResponse.next_batch,
				});
				public_rooms = public_rooms.concat(publicRoomsResponse.chunk);
			}
			this.lastPublicCheck = Date.now();
			this.publicRooms = public_rooms;
			return public_rooms;
		},

		async getAllRooms(): Promise<Array<MatrixRoom>> {
			const rooms = await this.client.getRooms();
			return rooms;
		},

		/**
		 * Uses the client to join a room (a no op when already a member) and updates the rooms in the store. Can throw
		 * an error.
		 * @param room_id - a room id
		 * @throws error - an error when something goes wrong joining the room. For example a forbidden respons or a rate limited
		 * response
		 */
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

		getPrivateRoomWithMembers(memberIds: Array<string>, rooms: Array<any>): boolean | string {
			for (let index = rooms.length - 1; index >= 0; index--) {
				const room = rooms[index] as Room;
				const roomMemberIds = fetchMemberIdsFromPrivateRoomName(room.name);
				roomMemberIds.sort();
				const found = JSON.stringify(memberIds.sort()) === JSON.stringify(roomMemberIds);
				if (found) {
					return room.roomId;
				}
			}
			return false;
		},

		async createPrivateRoomWith(other: any): Promise<{ room_id: string } | null> {
			const user = useUser();
			const me = user.user as User;
			const memberIds = [me.userId, other.userId];
			const allRooms = await this.getAllRooms();
			const existingRoomId = this.getPrivateRoomWithMembers(memberIds, allRooms);

			// Try joining existing by renaming
			if (existingRoomId !== false && typeof existingRoomId === 'string') {
				const rooms = useRooms();
				let name = rooms.room(existingRoomId)?.name;
				if (name) {
					// unHide room for me
					name = updatePrivateRoomName(name, me, false);
					this.renameRoom(existingRoomId, name);
				}
			}

			// If realy not exists, create new
			if (existingRoomId === false) {
				const privateRoomName = createNewPrivateRoomName([me, other]);
				const room = await this.createRoom({
					preset: 'trusted_private_chat',
					name: privateRoomName,
					visibility: 'private',
					invite: [other.userId],
					is_direct: true,
					creation_content: { type: RoomType.PH_MESSAGES_DM },
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
			const response = await this.client.setRoomName(roomId, name);
			this.updateRooms();
			return response;
		},

		async setTopic(roomId: string, topic: string) {
			await this.client.setRoomTopic(roomId, topic);
			this.updateRooms();
		},

		async leaveRoom(roomId: string) {
			await this.client.leave(roomId);
			this.updateRooms();
		},

		async setPrivateRoomHiddenStateForUser(room: Room, hide: boolean) {
			let name = room.name;
			const user = useUser();
			const me = user.user as User;
			name = updatePrivateRoomName(name, me, hide);
			await this.client.setRoomName(room.roomId, name);
			this.updateRooms();
		},

		/**
		 * Adds users which are mentioned by '@' in the message to m.mentions field, mutating the content argument.
		 */
		async _addUserMentionsToMessageContent(content: TTextMessageEventContent) {
			if (content.body.includes('@')) {
				const users = await this.getUsers();
				let mentionedUsersName = [];
				const mentionedUsers = content.body.split('@');
				mentionedUsersName = users
					.filter((user) => {
						return mentionedUsers.some((menUser: any) => user.rawDisplayName !== undefined && (menUser.includes(user.rawDisplayName) || menUser === user.rawDisplayName));
					})
					.map((users) => users.userId)
					.filter((displayName): displayName is string => displayName !== undefined);

				content['m.mentions']['user_ids'] = content['m.mentions']['user_ids'].concat(mentionedUsersName);
			}
		},

		_createEmptyMentions(): TMentions {
			return {
				room: false,
				user_ids: [],
			};
		},

		/**
		 * Mutates the message content appropriately to become a reply to the inReplyTo event.
		 */
		_addInReplyToToMessageContent(content: TTextMessageEventContent, inReplyTo: TMessageEvent) {
			// todo: fix in new version of replies (issue #313)
			//@ts-ignore
			content['m.relates_to'] = { 'm.in_reply_to': { event_id: inReplyTo.event_id, x_event_copy: structuredClone(inReplyTo) } };

			// Don't save inReplyTo of inReplyTo event.
			// todo: fix in new version of replies (issue #313)
			//@ts-ignore
			delete content['m.relates_to']?.['m.in_reply_to']?.x_event_copy?.content?.['m.relates_to']?.['m.in_reply_to']?.x_event_copy;

			// Mention appropriate users

			if (
				inReplyTo.content.msgtype === 'm.text' &&
				// For backwards compatibility
				inReplyTo.content['m.mentions']
			) {
				const newUsers = [...inReplyTo.content['m.mentions'].user_ids, inReplyTo.sender];
				content['m.mentions'].user_ids.concat(newUsers);
			}
		},

		async _constructMessageContent(text: string, inReplyTo?: TMessageEvent): Promise<TTextMessageEventContent> {
			let content = ContentHelpers.makeTextMessage(text) as TTextMessageEventContent;

			const cleanText = hasHtml(text);
			if (typeof cleanText === 'string') {
				const html = sanitizeHtml(text);
				content = ContentHelpers.makeHtmlMessage(cleanText, html) as TTextMessageEventContent;
			}

			// content should have TTextMessageEventContent type after this step (and not before), but don't know how to change type.
			content['m.mentions'] = this._createEmptyMentions();

			await this._addUserMentionsToMessageContent(content);

			// If the message is a reply to another event.
			if (inReplyTo) {
				this._addInReplyToToMessageContent(content, inReplyTo);
			}

			return content;
		},

		/** Send a message containing `text` in room with `roomId`, optionally replying to the message event `inReplyTo`.
		 * If the room is a private room (a one-on-one conversation), then a check will be made to make sure the room is visible for both users.
		 * @param roomId
		 * @param text
		 * @param inReplyTo Possible event to which the new message replies.
		 */
		async addMessage(roomId: string, text: string, inReplyTo?: TMessageEvent) {
			const rooms = useRooms();
			const room = rooms.room(roomId);
			const content = await this._constructMessageContent(text, inReplyTo);

			// @ts-ignore
			// todo: fix this (issue #808)
			await this.client.sendMessage(roomId, content);

			// make room visible for all members if private room
			if (room && room.isPrivateRoom()) {
				const originalName = room.name;
				const newName = refreshPrivateRoomName(originalName);
				if (originalName !== newName) {
					await this.renameRoom(room.roomId, newName);
				}
			}
		},

		async addSignedMessage(roomId: string, signedMessage: YiviSigningSessionResult) {
			const content = {
				msgtype: 'pubhubs.signed_message',
				body: 'signed message',
				signed_message: signedMessage,
			};

			// @ts-ignore
			// todo: fix this (issue #808)
			await this.client.sendMessage(roomId, content);
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

		async sendPrivateReceipt(event: MatrixEvent) {
			if (!event) return;
			const rooms = useRooms();
			if (event.getRoomId() && rooms.roomsSeen[event.getRoomId()!] && rooms.roomsSeen[event.getRoomId()!] >= event.localTimestamp) {
				return;
			}
			const loggedInUser = useUser();
			const content = {
				'm.read.private': {
					[loggedInUser.user.userId]: {
						ts: event.localTimestamp,
						thread_id: 'main',
					},
				},
			};
			rooms.roomsSeen[event.getRoomId()!] = event.localTimestamp;
			await this.client.sendReceipt(event, ReceiptType.ReadPrivate, content);
		},

		async addAskDisclosureMessage(roomId: string, body: string, askDisclosureMessage: AskDisclosureMessage) {
			const content = {
				msgtype: 'pubhubs.ask_disclosure_message',
				body: body,
				ask_disclosure_message: askDisclosureMessage,

				// satisfy the sdk's type checking
				'm.new_content': undefined,
				'm.relates_to': undefined,
			};

			// @ts-ignore
			// todo: fix this (issue #808)
			await this.client.sendMessage(roomId, content);
		},

		async addImage(roomId: string, uri: string) {
			try {
				await this.client.sendImageMessage(roomId, uri, undefined);
			} catch (error) {
				this.logger.log(SMI.STORE_TRACE, 'swallowing add image error', { error });
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
				msgtype: MsgType.File,
				url: uri,

				// satisfy the sdk's type checking
				'm.new_content': undefined,
				'm.relates_to': undefined,
			};
			try {
				// @ts-ignore
				// todo: fix this (issue #808)
				await this.client.sendMessage(roomId, content);
			} catch (error) {
				this.logger.log(SMI.STORE_TRACE, 'swallowing add file error', { error });
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
				this.logger.log(SMI.STORE_TRACE, 'swallowing resend event error', { error });
			}
		},

		async changeDisplayName(name: string) {
			try {
				await this.client.setDisplayName(name);
			} catch (error: any) {
				this.showError(error);
			}
		},

		async changeAvatar(url: string) {
			try {
				await this.client.setAvatarUrl(url);
			} catch (error: any) {
				this.showError(error);
			}
		},

		async findUsers(term: string): Promise<Array<any>> {
			const response = await this.client.searchUserDirectory({ term: term });
			return response.results;
		},

		async getUsers(): Promise<Array<MatrixUser>> {
			if (!this.client.getUsers) {
				return [];
			}
			const users = (await this.client.getUsers()) as Array<MatrixUser>;
			// Removed this hack @ 04 april 2024, if all seems well at next merge to stable, this can be removed permanent
			// Doesn't get all displaynames correct from database, this is a hack to change displayName to only the pseudonym
			// users = users.map((user) => {
			// 	if (user.userId === user.displayName) {
			// 		user.displayName = filters.extractPseudonym(user.userId);
			// 	}
			// 	return user;
			// });
			return users;
		},

		/**
		 * Performs search on content of given room
		 *
		 * @returns the promise of searchRoomEvents or an empty promise (when no term is given)
		 */
		async searchRoomEvents(term: string, searchParameters: TSearchParameters): Promise<ISearchResults> {
			if (!term || !term.length) {
				const emptySearchResult: ISearchResults = {
					results: [],
					highlights: [],
				};
				return emptySearchResult;
			}

			return await this.client.searchRoomEvents({ term: term, filter: { rooms: [searchParameters.roomId] } });
		},

		/**
		 * Performs pagination on current searchResponse
		 *
		 * @returns the promise of searchRoomEvents or an empty promise (when no term is given)
		 */
		async backPaginateRoomEventsSearch(searchResponse: ISearchResults) {
			if (searchResponse?.next_batch) {
				return this.client.backPaginateRoomEventsSearch(searchResponse);
			}
			return searchResponse;
		},

		async hasUserJoinedHubFirstTime(): Promise<Object> {
			const loggedInUser = useUser();
			const resp = await api_synapse.apiPOST<Object>(api_synapse.apiURLS.joinHub, { user: loggedInUser.user.userId });
			return resp;
		},
	},
});

export { usePubHubs };
