import { defineStore } from 'pinia';

import { Events, PubHubsMgType, RedactReasons } from '@/logic/core/events';
import { api_matrix, api_synapse } from '@/logic/core/api';
import { Authentication } from '@/logic/core/authentication';
import { createNewPrivateRoomName, fetchMemberIdsFromPrivateRoomName, refreshPrivateRoomName, updatePrivateRoomName } from '@/logic/core/privateRoomNames';
import { hasHtml, sanitizeHtml } from '@/logic/core/sanitizer';
import { LOGGER } from '@/logic/foundation/Logger';
import { SMI } from '@/logic/foundation/StatusMessage';
import { AskDisclosureMessage, YiviSigningSessionResult } from '@/model/components/signedMessages';
import { TMentions, TMessageEvent, TTextMessageEventContent } from '@/model/events/TMessageEvent';
import Room from '@/model/rooms/Room';
import { TSearchParameters } from '@/model/search/TSearch';
import { useConnection } from '@/logic/store/connection';
import { RoomType } from '@/logic/store/rooms';
import { TPublicRoom, useRooms } from '@/logic/store/store';
import { User, useUser } from '@/logic/store/user';
import { router } from '@/logic/core/router';
import { ContentHelpers, EventType, ISearchResults, ISendEventResponse, MatrixClient, MatrixError, MatrixEvent, Room as MatrixRoom, User as MatrixUser, MsgType } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk/lib/@types/read_receipts';
import { useMessageActions } from '@/logic/store/message-actions';
import { RoomPowerLevelsEventContent } from 'matrix-js-sdk/lib/@types/state_events';

let publicRoomsLoading: Promise<any> | null = null; // outside of defineStore to guarantee lifetime, not accessible outside this module

const logger = LOGGER;

const usePubHubs = defineStore('pubhubs', {
	state: () => ({
		Auth: new Authentication(),
		client: {} as MatrixClient,
		publicRooms: [] as TPublicRoom[],
		lastPublicCheck: 0,
	}),

	getters: {
		getBaseUrl(state) {
			return state.Auth.getBaseUrl();
		},

		// To get user Id for any user - this can be useful for getting user Id for admin when working with admin
		getUserId(state) {
			return state.client.getUserId();
		},
	},

	actions: {
		centralLoginPage() {
			// @ts-ignore
			const centralLoginUrl = _env.PARENT_URL + '/client';
			window.top?.location.replace(centralLoginUrl);
		},

		async login() {
			logger.trace(SMI.STARTUP, 'START PubHubs.login');
			try {
				const x = await this.Auth.login();

				logger.trace(SMI.STARTUP, 'PubHubs.logged in (X) - started client');
				this.client = x as MatrixClient;
				const user = useUser();
				user.setClient(x as MatrixClient);

				const events = new Events(this.client as MatrixClient);
				events.initEvents();
				// 2024 12 03 The await is removed, because of slow loading testhub
				// After the next merge to stable, in case this gives no problems,
				// the old code and comments can be removed
				// await events.initEvents();

				logger.trace(SMI.STARTUP, 'PubHubs.logged in ()');
				const connection = useConnection();
				connection.on();
				const newUser = user.user;

				if (newUser !== null) {
					api_synapse.setAccessToken(this.Auth.getAccessToken()!); //Since user isn't null, we expect there to be an access token.
					api_matrix.setAccessToken(this.Auth.getAccessToken()!);
					user.fetchIsAdministrator(this.client as MatrixClient);
					user.fetchUserFirstTimeLoggedIn();

					try {
						const profile = await this.client.getProfileInfo(newUser.userId);
						user.setProfile(profile);
					} catch (error) {
						logger.trace(SMI.STARTUP, 'There is no profile information (avatar or displayname) for this user.', { error });
					}

					// Perhaps in the future change this to asynchronous so there is no waiting for this.
					// But then the Avatar needs to be displayed only when it is fetched, to prohibit flashing
					// like this:
					// this.client.getProfileInfo(newUser.userId, 'avatar_url').then((avatarUrl) => {
					// 	if (avatarUrl.avatar_url !== undefined) {
					// 		user.setAvatarMxcUrl(avatarUrl.avatar_url);
					// 	}
					// });

					this.updateRooms();
					// 2024 12 03 The await is removed, because of slow loading testhub
					// After the next merge to stable, in case this gives no problems,
					// the old code and comments can be removed
					//await this.updateRooms();
				}
			} catch (error: any) {
				logger.trace(SMI.STARTUP, 'Something went wrong while creating a matrix-js client instance or logging in', { error });
				router.push({ name: 'error-page' });
			}
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
			logger.trace(SMI.STORE, 'PubHubs.updateRooms');
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
				if (error.errcode !== 'M_FORBIDDEN' && error.data) {
					this.showDialog(error.data.error as string);
				} else {
					logger.trace(SMI.STORE, 'showing error dialog', { error });
				}
			} else {
				this.showDialog('Unfortanatly an error occured. Please contact the developers.\n\n' + error.toString);
			}
		},

		/**
		 * Wrapper methods for matrix client
		 */

		// Is the given user a member of the given room?
		async isUserRoomMember(user_id: string, room_id: string): Promise<boolean> {
			try {
				const joinedMembers = await this.client.getJoinedRoomMembers(room_id);
				return joinedMembers.joined[user_id] !== undefined;
			} catch {
				// can give error when user is no member and room previews are disabled
				return false;
			}
		},

		// If the admin is only room admin and there are other normal users in the room.
		async isSingleAdministration(room_id: string) {
			const user = useUser();
			const rooms = useRooms();

			if (!user.isAdministrator) return false;

			const joinedMembers = await this.client.getJoinedRoomMembers(room_id);
			// Check power level to see if there are users with PL of 100
			const powerLevelContext = await this.getPoweLevelEventContent(room_id);

			// If the current user (i.e., admin) is not in powerlevel - the admin is not 'room' admin.
			if (powerLevelContext.users![user.user.userId] === undefined) return false;
			const usersPL100 = Object.keys(powerLevelContext.users!);

			// Check membership of users with PL100.
			const membershipAdmins = usersPL100.map((userId) => rooms.currentRoom?.getMember(userId)?.membership === 'join');
			const onlyOneAdminInRoom = membershipAdmins.filter(Boolean).length === 1;
			// If there is only one admin who has joined the room and if he leaves then room will be without administration.
			if (onlyOneAdminInRoom && Object.keys(joinedMembers.joined).length > 1) return true;
			return false;
		},

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
		 * @param roomId
		 * @param eventId
		 * @returns a single event based on roomId/eventId
		 */
		async getEvent(roomId: string, eventId: string) {
			const response = await this.client.fetchRoomEvent(roomId, eventId);
			return response;
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

		_createEmptyMentions(): TMentions {
			return {
				room: false,
				user_ids: [],
			};
		},

		/**
		 * Adds users which are mentioned by '@' in the message to m.mentions field, mutating the content argument.
		 * @param content
		 */
		async _addUserMentionsToMessageContent(content: TTextMessageEventContent) {
			content['m.mentions'] = this._createEmptyMentions();

			if (content.body.includes('@')) {
				const users = await this.getUsers();
				const mentionedUsers = content.body.split('@');
				const mentionedUsersName = users
					.filter((user) => {
						return mentionedUsers.some((menUser: any) => user.rawDisplayName !== undefined && menUser.includes(user.rawDisplayName));
					})
					.map((users) => users.userId)
					.filter((displayName): displayName is string => displayName !== undefined);

				content['m.mentions']['user_ids'] = content['m.mentions']['user_ids'].concat(mentionedUsersName);
			}
		},

		/**
		 * Mutates the message content appropriately for the relates to field: Thread and/or Reply
		 * @param content
		 * @param threadRoot
		 * @param inReplyTo
		 */
		_addRelatesToMessageContent(content: TTextMessageEventContent, threadRoot?: TMessageEvent, inReplyTo?: TMessageEvent) {
			if (threadRoot || inReplyTo) {
				content['m.relates_to'] = {};

				if (threadRoot) {
					content['m.relates_to'].event_id = threadRoot.event_id;
					content['m.relates_to'].rel_type = 'm.thread';
					//is_falling_back: true,
				}

				if (inReplyTo) {
					content['m.relates_to']['m.in_reply_to'] = { event_id: inReplyTo.event_id };

					// Mention appropriate users
					if (
						inReplyTo.content.msgtype === 'm.text' &&
						// For backwards compatibility
						inReplyTo.content['m.mentions']
					) {
						const newUsers = [...inReplyTo.content['m.mentions'].user_ids, inReplyTo.sender];
						content['m.mentions'].user_ids.concat(newUsers);
					}
				}
			}
		},

		/**
		 * Constructs the content of a text message
		 * @param text Text of message
		 * @param threadRoot Root of thread the message might belong to
		 * @param inReplyTo Original event for when message is a reply
		 * @returns The content
		 */
		async _constructMessageContent(text: string, threadRoot: TMessageEvent | undefined, inReplyTo: TMessageEvent | undefined): Promise<TTextMessageEventContent> {
			let content = undefined;

			// Set body of content
			const cleanText = hasHtml(text);
			if (typeof cleanText === 'string') {
				const html = sanitizeHtml(text);
				content = ContentHelpers.makeHtmlMessage(cleanText, html) as TTextMessageEventContent;
			} else {
				content = ContentHelpers.makeTextMessage(text) as TTextMessageEventContent;
			}

			// Set mention
			await this._addUserMentionsToMessageContent(content);

			// Set threadRoot and/or reply
			if (threadRoot || inReplyTo) {
				this._addRelatesToMessageContent(content, threadRoot, inReplyTo);
			}
			return content;
		},

		/** Send a message containing `text` in room with `roomId`, optionally replying to the message event `inReplyTo`.
		 * If the room is a private room (a one-on-one conversation), then a check will be made to make sure the room is visible for both users.
		 * @param roomId
		 * @param text
		 * @param inReplyTo Possible event to which the new message replies.
		 */
		async addMessage(roomId: string, text: string, threadRoot: TMessageEvent | undefined, inReplyTo: TMessageEvent | undefined) {
			const rooms = useRooms();
			const room = rooms.room(roomId);
			const content = await this._constructMessageContent(text, threadRoot, inReplyTo);

			/*
			   Sendmessage gives a console warning when adding a thread event, because the current timeline does not have a threadId.
			   For now we skip this , since the functionality is not affected by it.
			   These consoles can be used when checking for the reason of the warning.
			*/
			// console.error('does client support threads: ', this.client.supportsThreads());
			// console.error('threadTimelineSets: ', room?.matrixRoom.threadsTimelineSets);
			// console.error('Thread.hasServerSideSupport: ', Thread.hasServerSideSupport);     // Thread from 'matrix-js-sdk'
			// console.error('Thread.hasServerSideListSupport: ', Thread.hasServerSideListSupport);

			const threadId = threadRoot?.event_id ?? null;
			await this.client.sendMessage(roomId, threadId, content);

			// make room visible for all members if private room
			if (room && room.isPrivateRoom()) {
				const originalName = room.name;
				const newName = refreshPrivateRoomName(originalName);
				if (originalName !== newName) {
					await this.renameRoom(room.roomId, newName);
				}
			}
		},

		/**
		 * Adds a message to the room
		 * @param messageContent
		 * @param roomId
		 * @param threadRoot - when given: the event at the root of the thread
		 * @param inReplyTo
		 */
		submitMessage(messageContent: string, roomId: string, threadRoot: TMessageEvent | undefined, inReplyTo: TMessageEvent | undefined) {
			const messageActions = useMessageActions();
			this.addMessage(roomId, messageContent, threadRoot, inReplyTo);
			messageActions.replyingTo = undefined;
		},

		/** Sign and send a message in a room
		 * @param message - message to send
		 * @param attributes - attributes to sign with
		 */
		signAndSubmitMessage(message: string, attributes: string[]): Promise<void> {
			return new Promise((resolve, reject) => {
				const rooms = useRooms();
				const accessToken = this.Auth.getAccessToken();
				//accessToken && rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, accessToken, this.finishedSigningMessage);
				if (accessToken) {
					const handler = this.createFinishedSigningMessageHandler.call(this, resolve, reject);
					rooms.yiviSignMessage(message, attributes, rooms.currentRoomId, accessToken, handler);
				}
			});
		},

		/** Method to get the yiviSignMessage to return to a promise
		 * @param resolve
		 * @param reject
		 */
		createFinishedSigningMessageHandler(resolve: () => void, reject: () => void) {
			return async (result: YiviSigningSessionResult) => {
				try {
					const rooms = useRooms();
					await this.addSignedMessage(rooms.currentRoomId, result);
					resolve();
				} catch (error) {
					reject();
				}
			};
		},

		/**
		 * Adds the signed message to the room
		 * @param roomId
		 * @param signedMessage
		 */
		async addSignedMessage(roomId: string, signedMessage: YiviSigningSessionResult) {
			const content = {
				msgtype: PubHubsMgType.SignedMessage as any, // client expects string from MsgType enum, to make our own type castable send this as any
				body: 'signed message',
				signed_message: signedMessage,
				ph_body: '',
			};
			await this.client.sendMessage(roomId, content);
		},

		/**
		 * @param roomId
		 * @param eventId
		 */
		async deleteMessage(roomId: string, eventId: string, threadId?: string) {
			const reason = threadId ? { reason: RedactReasons.DeletedFromThread } : { reason: RedactReasons.Deleted };
			await this.client.redactEvent(roomId, eventId, undefined, reason);
		},

		async sendReadReceipt(event: MatrixEvent) {
			if (!event) return;
			const loggedInUser = useUser();
			const content = {
				'm.read': {
					[loggedInUser.userId!]: {
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
					[loggedInUser.userId!]: {
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
				msgtype: PubHubsMgType.AskDisclosureMessage as any, // client expects string from MsgType enum, to make our own type castable send this as any
				body: body,
				ask_disclosure_message: askDisclosureMessage,

				// satisfy the sdk's type checking
				'm.new_content': undefined,
				'm.relates_to': undefined,
			};

			await this.client.sendMessage(roomId, content);
		},

		async addImage(roomId: string, threadId: string | undefined, uri: string) {
			try {
				const thread = threadId && threadId.length > 0 ? threadId : null;
				await this.client.sendImageMessage(roomId, thread, uri, undefined);
			} catch (error) {
				logger.trace(SMI.STORE, 'swallowing add image error', { error });
			}
		},

		async addFile(roomId: string, threadId: string | undefined, file: File, uri: string) {
			const thread = threadId && threadId.length > 0 ? threadId : null;
			const content = {
				body: file.name,
				filename: file.name,
				info: {
					mimetype: file.type,
					size: file.size,
				},
				msgtype: MsgType.File as any, // client expects string from MsgType enum, to make our own type castable send this as any
				url: uri,

				// satisfy the sdk's type checking
				'm.new_content': undefined,
				'm.relates_to': undefined,
			};
			try {
				await this.client.sendMessage(roomId, thread, content);
			} catch (error) {
				logger.trace(SMI.STORE, 'swallowing add file error', { error });
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
				logger.trace(SMI.STORE, 'swallowing resend event error', { error });
			}
		},

		async changeDisplayName(name: string) {
			const user = useUser();
			const restoreUserName = user.displayName;
			// First set in the UX for fast response there
			user.setDisplayName(name);
			try {
				await this.client.setDisplayName(name);
			} catch (error: any) {
				this.showError(error);
				// Set to old username if error
				user.setDisplayName(restoreUserName);
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

		/**
		 * Makes an authenticated request to get the media and returns a local URL to the retrieved file (which does not need authorization).
		 * This is useful for usage in <img> tags, where you cannot send an access token.
		 *
		 * Note: A better approach might be to use service workers to add the access token.
		 */
		async getAuthorizedMediaUrl(url: string): Promise<string | null> {
			const accessToken = this.Auth.getAccessToken();

			if (!accessToken) {
				console.error('Access token is missing');
				return null;
			}

			const options = {
				headers: {
					Authorization: 'Bearer ' + accessToken,
				},
				method: 'GET',
			};

			try {
				const response = await fetch(url, options);

				const blob = await response.blob();

				if (blob) {
					const fileURL = window.URL.createObjectURL(blob);
					return fileURL;
				}
				return null;
			} catch (error) {
				console.error('Error downloading the file: ', error);
				return null;
			}
		},

		/**
		 *
		 * @returns Returns the room PowerLevel Event Content
		 */
		async getPoweLevelEventContent(roomId: string): Promise<RoomPowerLevelsEventContent> {
			return await this.client.getStateEvent(roomId, 'm.room.power_levels', '');
		},

		/**
		 * @param roomId  Id of the room
		 * @param newPls level event content which consists of user object that contains the userId and power level.
		 * @returns Sets the power level for the user.
		 */
		async setPowerLevelEventContent(roomId: string, newPls: RoomPowerLevelsEventContent): Promise<ISendEventResponse> {
			return await this.client.sendStateEvent(roomId, EventType.RoomPowerLevels, newPls, '');
		},
	},
});

export type PubHubsStore = ReturnType<typeof usePubHubs>;

export { usePubHubs };
