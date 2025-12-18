// Models
// Packages
import { ContentHelpers, EventTimeline, EventType, ISearchResults, ISendEventResponse, MatrixClient, MatrixError, MatrixEvent, Room as MatrixRoom, User as MatrixUser, MsgType } from 'matrix-js-sdk';
import { ReceiptType } from 'matrix-js-sdk/lib/@types/read_receipts';
import { RoomPowerLevelsEventContent } from 'matrix-js-sdk/lib/@types/state_events';
import { RoomMessageEventContent, TimelineEvents } from 'matrix-js-sdk/lib/types';
import { defineStore } from 'pinia';

// Composables
import { useMatrix } from '@hub-client/composables/matrix.composable';

// Logic
import { api_matrix, api_synapse } from '@hub-client/logic/core/api';
import { Authentication } from '@hub-client/logic/core/authentication';
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createNewPrivateRoomName, refreshPrivateRoomName, updatePrivateRoomName } from '@hub-client/logic/core/privateRoomNames';
import { router } from '@hub-client/logic/core/router';
import { hasHtml, sanitizeHtml } from '@hub-client/logic/core/sanitizer';
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';
import { getRoomType } from '@hub-client/logic/pubhubs.logic';

import { AskDisclosureMessage, YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
import { Redaction, RelationType, imageTypes } from '@hub-client/models/constants';
import { TMentions, TMessageEvent, TTextMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { TVotingWidgetClose, TVotingWidgetEditEventContent, TVotingWidgetMessageEventContent, TVotingWidgetOpen, TVotingWidgetPickOption, TVotingWidgetVote } from '@hub-client/models/events/voting/TVotingMessageEvent';
import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
import Room from '@hub-client/models/rooms/Room';
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { TSearchParameters } from '@hub-client/models/search/TSearch';

// Stores
import { useConnection } from '@hub-client/stores/connection';
import { useMessageActions } from '@hub-client/stores/message-actions';
import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';
import { User, useUser } from '@hub-client/stores/user';

const logger = LOGGER;
const publicRoomsLoading: Promise<any> | null = null; // Outside of defineStore to guarantee lifetime, not accessible outside this module
const updateRoomsPerforming: Promise<void> | null = null; // Outside of defineStore to guarantee lifetime, not accessible outside this module

const usePubhubsStore = defineStore('pubhubs', {
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

		// To get user Id for any user. This can be useful for getting user Id for admin when working with admin
		getUserId(state) {
			return state.client.getUserId();
		},
	},

	actions: {
		centralLoginPage() {
			// @ts-expect-error
			const centralLoginUrl = _env.PARENT_URL + '/client';
			window.top?.location.replace(centralLoginUrl);
		},

		async login() {
			logger.trace(SMI.STARTUP, 'START PubHubs.login');
			try {
				const _client = await this.Auth.login();

				logger.trace(SMI.STARTUP, 'PubHubs.logged in (X) - started client');
				this.client = _client as MatrixClient;

				const user = useUser();
				user.setClient(_client as MatrixClient);

				const { init, startSync } = useMatrix();
				init(_client as MatrixClient);
				startSync(); // Do not await this async function, since it will be running continuously in the background

				logger.trace(SMI.STARTUP, 'PubHubs.logged in ()');

				const connection = useConnection();
				connection.on();

				const newUserId = user.userId;
				if (newUserId !== null) {
					api_synapse.setAccessToken(this.Auth.getAccessToken()!); // Since user isn't null, we expect there to be an access token.
					api_matrix.setAccessToken(this.Auth.getAccessToken()!);
					user.fetchIsAdministrator(this.client as MatrixClient);
					user.fetchIfUserNeedsConsent();

					try {
						const profile = await this.client.getProfileInfo(newUserId);
						user.setProfile(profile);
					} catch (error) {
						logger.trace(SMI.STARTUP, 'There is no profile information (avatar or displayname) for this user.', { error });
					}
				}
			} catch (error: any) {
				logger.trace(SMI.STARTUP, 'Something went wrong while creating a matrix-js client instance or logging in', { error });
				router.push({ name: 'error-page' });
			}
		},

		logout() {
			this.Auth.logout();
		},

		/**
		 * To avoid calling the same async method multiple times, we can use this method to ensure
		 * that only one instance of the async function is running at a time.
		 *
		 * @param func - The async function to be executed
		 * @param stateVar - The state variable to keep track of the current promise
		 * @returns - The result of the passed async function
		 */
		async ensureSingleExecution<T>(func: () => Promise<T>, stateVar: { current: Promise<T> | null }): Promise<T> {
			// If a promise is already running, return it
			if (stateVar.current) {
				return stateVar.current;
			}

			// Create and store the promise
			stateVar.current = new Promise<T>((resolve, reject) => {
				try {
					resolve(func());
				} catch (error) {
					reject(error);
				} finally {
					stateVar.current = null; // Reset state after execution
				}
			});

			// Return the promise
			return stateVar.current;
		},

		async updateRooms() {
			return this.ensureSingleExecution(() => this.performUpdateRooms(), {
				current: updateRoomsPerforming,
			});
		},

		/**
		 * Actual performing of updateRooms
		 * This method will check with the homeserver for changes in joined rooms and update the local situation to reflect that.
		 */
		async performUpdateRooms() {
			const rooms = useRooms();

			const allPublicRooms = await this.getAllPublicRooms(); // all public rooms, including their names
			const joinedRooms = (await this.client.getJoinedRooms()).joined_rooms; // all joined rooms of the user
			const knownRooms = this.client.getRooms(); // get all the rooms of the matrix js SDK client

			// update the rooms in the store with the known rooms
			if (knownRooms?.length > 0) {
				rooms.updateRoomsWithMatrixRooms(knownRooms.filter((room: any) => joinedRooms.indexOf(room.roomId) !== -1));
			}

			// Make sure the matrix js SDK client is aware of all the rooms the user has joined
			// knownrooms possibly does not have all rooms, so rejoin every room in joinedRooms that is not in knownrooms
			// this actually does nothing when already joined, but it will return the room to be stored

			for (const room_id of joinedRooms) {
				if (!knownRooms.some((kr: any) => kr.roomId === room_id)) {
					const roomName = allPublicRooms.find((r: any) => r.room_id === room_id)?.name ?? undefined;

					// join again and then store the room in the client store
					// and when the name is known in the rooms store
					this.client.joinRoom(room_id).then((room) => {
						this.client.store.storeRoom(room);
						if (roomName) {
							rooms.updateRoomsWithMatrixRoom(room, roomName);
						}
					});
				}
			}

			rooms.fetchPublicRooms();
		},

		/**
		 * Initializes the room list with all joined rooms of the current user.
		 * Also fetches all public rooms from the server.
		 */
		async initRoomList() {
			const rooms = useRooms();

			const allPublicRooms = await this.getAllPublicRooms(); // all public rooms, including their names
			const joinedRooms = (await this.client.getJoinedRooms()).joined_rooms; // all joined rooms of the user

			rooms.setRoomsLoaded(false);

			// Make sure the matrix js SDK client is aware of all the rooms the user has joined
			// Since the SDK not always has knowledge of the rooms in time we rejoin every room in joinedRooms
			// this actually does nothing when already joined, but it will return the room to be stored
			const roomsToJoin = joinedRooms.filter((joinedRoomId) => allPublicRooms.some((publicRoom) => publicRoom.room_id === joinedRoomId && publicRoom.name));

			for (const room_id of roomsToJoin) {
				const roomName = allPublicRooms.find((r: any) => r.room_id === room_id)?.name;
				this.client.joinRoom(room_id).then((room) => {
					this.client.store.storeRoom(room);
					rooms.updateRoomsWithMatrixRoom(room, roomName);
				});
			}

			rooms.fetchPublicRooms();
			rooms.setRoomsLoaded(true);
		},

		/**
		 * Updates the store with this one room
		 * Fetches the public rooms from the server as update
		 */
		async updateRoom(roomId: string, roomLeave: boolean = false) {
			const rooms = useRooms();

			if (roomLeave) {
				rooms.deleteRoomsWithMatrixRoom(roomId);
				return;
			}

			let matrixRoom = this.client.getRoom(roomId);
			try {
				matrixRoom ??= await this.client.joinRoom(roomId);
				if (matrixRoom) {
					this.client.store.storeRoom(matrixRoom);

					const publicRoomEntry = (await this.getAllPublicRooms()).find((r: any) => r.room_id === roomId);
					const roomName = publicRoomEntry?.name ?? matrixRoom.name ?? undefined;

					let roomType: string = RoomType.PH_MESSAGES_DEFAULT;
					try {
						const state = matrixRoom.getLiveTimeline().getState(EventTimeline.FORWARDS);
						const createEvt = state?.getStateEvents(EventType.RoomCreate, '') ?? null;
						if (createEvt?.getContent && createEvt.getContent()?.type) {
							roomType = createEvt.getContent().type ?? roomType;
						}
					} catch (_) {
						// Ignore for now
					}

					rooms.initRoomsWithMatrixRoom(matrixRoom, roomName, roomType, []);
				}
			} catch (err) {
				logger.trace(SMI.STORE, 'updateRoom failed', { roomId, err });
				throw err;
			}
		},

		/**
		 * Helpers
		 */

		showDialog(message: string) {
			alert(message);
		},

		showError(error: string | MatrixError) {
			if (typeof error === 'string') {
				this.showDialog('Unfortanatly an error occured. Please contact the developers.\n\n' + error.toString);
			} else if (error.errcode !== 'M_FORBIDDEN' && error.data) {
				this.showDialog(error.data.error as string);
			} else {
				logger.trace(SMI.STORE, 'showing error dialog', { error });
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

		async getAllPublicRooms() {
			return this.ensureSingleExecution(() => this.performGetAllPublicRooms(), { current: publicRoomsLoading });
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

			// DANGER this while loop turns infinite when the generated public rooms request is a POST request. This happens when the optional 'options' parameter is supplied to 'this.client.publicRooms'. Then the pagination doesn't work anymore and the loop becomes infinite.
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

		getAllRooms(): Array<MatrixRoom> {
			return this.client.getRooms();
		},

		getRoom(roomId: string): MatrixRoom | null {
			return this.client.getRoom(roomId);
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
		async joinRoom(room_id: string): Promise<void> {
			const rooms = useRooms();

			try {
				const matrixRoom = await this.client.joinRoom(room_id);
				this.client.store.storeRoom(matrixRoom);
				let roomType: string = getRoomType(matrixRoom);
				rooms.initRoomsWithMatrixRoom(matrixRoom, matrixRoom?.name ?? undefined, roomType, []);
			} catch (err) {
				throw err;
			}
		},

		async invite(room_id: string, user_id: string, reason = undefined) {
			await this.client.invite(room_id, user_id, reason);
		},

		async createRoom(options: any): Promise<{ room_id: string }> {
			const room = await this.client.createRoom(options);
			return room;
		},

		getPrivateRoomWithMembers(memberIds: Array<string>, rooms: Array<any>, stewardRoomId: string = ''): boolean | string {
			for (let index = rooms.length - 1; index >= 0; index--) {
				const roomId = (rooms[index] as Room).roomId;
				const room = this.client.getRoom(roomId);
				if (!room) return false;
				const roomMembers = room.getMembers();
				const roomMemberIds = roomMembers.map((member) => member.userId);
				roomMemberIds.sort();
				const found = JSON.stringify(memberIds.sort()) === JSON.stringify(roomMemberIds);
				// Specific to Steward contact room because of how steward contact room are create.
				// Room name is based on RoomId,MembersList.

				if (room.getType() === RoomType.PH_MESSAGE_STEWARD_CONTACT) {
					if (room.name.split(',')[0] === stewardRoomId && found) {
						return room.roomId;
					}
				} else {
					if (found) {
						return room.roomId;
					}
				}
			}
			return false;
		},

		async createPrivateRoomWith(other: User | MatrixUser[], adminContact: boolean = false, stewardContact: boolean = false, roomIdForStewardRoomCreate: string = ''): Promise<{ room_id: string } | null> {
			const user = useUser();
			const me = user.user;
			let otherUsers: (User | MatrixUser)[];
			let roomType: RoomType;

			if (other instanceof Array) {
				otherUsers = other;
				roomType = adminContact ? RoomType.PH_MESSAGE_ADMIN_CONTACT : stewardContact ? RoomType.PH_MESSAGE_STEWARD_CONTACT : RoomType.PH_MESSAGES_GROUP;
			} else {
				otherUsers = [other];
				roomType = adminContact ? RoomType.PH_MESSAGE_ADMIN_CONTACT : stewardContact ? RoomType.PH_MESSAGE_STEWARD_CONTACT : RoomType.PH_MESSAGES_DM;
			}

			const memberIds = [me.userId!, ...otherUsers.map((u) => u.userId)];
			const allRoomsByType = this.getAllRooms().filter((room) => room.getType() === roomType);
			let existingRoomId;
			if (roomIdForStewardRoomCreate) {
				existingRoomId = this.getPrivateRoomWithMembers(memberIds, allRoomsByType, roomIdForStewardRoomCreate);
			} else {
				existingRoomId = this.getPrivateRoomWithMembers(memberIds, allRoomsByType);
			}
			// Try joining existing by renaming
			if (existingRoomId !== false && typeof existingRoomId === 'string') {
				const rooms = useRooms();
				let name = rooms.room(existingRoomId)?.name;
				if (name) {
					name = updatePrivateRoomName(name, me, false);
					this.renameRoom(existingRoomId, name);
				}
				return { room_id: existingRoomId };
			}

			// Create new room
			if (existingRoomId === false) {
				const otherUserForName = otherUsers;
				const privateRoomName = createNewPrivateRoomName([me, ...otherUserForName]);
				const stewardRoomName = roomIdForStewardRoomCreate === '' ? '' : roomIdForStewardRoomCreate + ',' + privateRoomName;
				const inviteIds = otherUsers.map((u) => u.userId);

				const room = await this.createRoom({
					preset: 'trusted_private_chat',
					name: roomIdForStewardRoomCreate === '' ? privateRoomName : stewardRoomName,
					visibility: 'private',
					invite: inviteIds,
					is_direct: true,
					creation_content: { type: roomType },
					topic: `PRIVATE: ${me.userId}, ${inviteIds.join(', ')}`,
					history_visibility: 'shared',
					guest_can_join: false,
				});
				return room;
			}

			return null;
		},

		async renameRoom(roomId: string, name: string) {
			const response = await this.client.setRoomName(roomId, name);
			this.updateRoom(roomId);
			return response;
		},

		async setTopic(roomId: string, topic: string) {
			await this.client.setRoomTopic(roomId, topic);
			this.updateRoom(roomId);
		},

		async leaveRoom(roomId: string) {
			await this.client.leave(roomId);
			this.updateRoom(roomId, true);
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

			if (content.body?.includes('@')) {
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
					content['m.relates_to']['m.in_reply_to'] = {
						event_id: inReplyTo.event_id,
					};

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
			// console.error('getCapabilities: ', this.client.getCapabilities());
			// console.error('does client support threads: ', this.client.supportsThreads());
			// console.error('threadTimelineSets: ', room?.matrixRoom.threadsTimelineSets);
			// console.error('Thread.hasServerSideSupport: ', Thread.hasServerSideSupport); // Thread from 'matrix-js-sdk'
			// console.error('Thread.hasServerSideListSupport: ', Thread.hasServerSideListSupport);

			const threadId = threadRoot?.event_id ?? null;
			await this.client.sendMessage(roomId, threadId, content as RoomMessageEventContent);

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

		/** Method to get the yiviSignMessage to return to a promise
		 * @param resolve
		 * @param reject
		 */
		createFinishedSigningMessageHandler(threadRoot: TMessageEvent | undefined, resolve: () => void, reject: () => void) {
			return async (result: YiviSigningSessionResult) => {
				try {
					const rooms = useRooms();
					await this.addSignedMessage(rooms.currentRoomId, result, threadRoot);
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
		async addSignedMessage(roomId: string, signedMessage: YiviSigningSessionResult, threadRoot: TMessageEvent | undefined) {
			const content = {
				msgtype: PubHubsMgType.SignedMessage as any, // client expects string from MsgType enum, to make our own type castable send this as any
				body: 'signed message',
				signed_message: signedMessage,
				ph_body: '',
				'm.relates_to': threadRoot
					? {
							event_id: threadRoot.event_id,
							rel_type: 'm.thread',
							'm.in_reply_to': undefined,
						}
					: undefined,
				// satisfy the sdk's type checking
				'm.new_content': undefined,
			};
			const threadId = threadRoot?.event_id ?? null;
			await this.client.sendMessage(roomId, threadId, content);
		},

		async addAnnouncementMessage(roomId: string, text: string, userPL: number) {
			const content = {
				msgtype: PubHubsMgType.AnnouncementMessage,
				body: text,
				// Sender power level
				sender: userPL,
			};
			// @ts-ignore
			// todo: fix this (issue #808)
			await this.client.sendMessage(roomId, content);
		},

		async addSignedFile(roomId: string, signedFileHash: YiviSigningSessionResult, originalEventId: string | undefined) {
			const content = {
				msgtype: PubHubsMgType.SignedFileMessage,
				body: 'signed file',
				signed_message: signedFileHash,
				'm.relates_to': {
					event_id: originalEventId,
				},
			};
			// @ts-ignore
			// todo: fix this (issue #808)
			console.log('addSignedFile ==>', roomId, content);
			const result = await this.client.sendEvent(roomId, PubHubsMgType.LibraryFileMessage, content);
			console.log('addSignedFile <==', result);
		},

		/**
		 * @param roomId
		 * @param eventId
		 */
		async deleteMessage(roomId: string, eventId: string, threadId?: string, reactEventId?: string) {
			const reason = threadId ? { reason: Redaction.DeletedFromThread } : { reason: Redaction.Deleted };
			await this.client.redactEvent(roomId, eventId, undefined, reason);

			if (reactEventId) {
				await this.client.redactEvent(roomId, reactEventId, undefined, reason);
			}
		},

		async deleteLibraryMessage(roomId: string, eventId: string) {
			await this.client.redactEvent(roomId, eventId, undefined, { reason: Redaction.DeletedFromLibrary });
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

		async addPoll(roomId: string, poll: Poll) {
			const content: TVotingWidgetMessageEventContent = {
				msgtype: PubHubsMgType.VotingWidget,
				body: poll.title,
				title: poll.title,
				description: poll.description,
				options: poll.options,
				type: poll.type,
				showVotesBeforeVoting: poll.showVotesBeforeVoting,
			};
			//@ts-ignore
			await this.client.sendMessage(roomId, content);
		},

		async addScheduler(roomID: string, scheduler: Scheduler) {
			const content: TVotingWidgetMessageEventContent = {
				msgtype: PubHubsMgType.VotingWidget,
				body: scheduler.title,
				title: scheduler.title,
				description: scheduler.description,
				location: scheduler.location,
				options: scheduler.options.filter((option) => option.status === 'filled'),
				type: scheduler.type,
				showVotesBeforeVoting: scheduler.showVotesBeforeVoting,
			};
			//@ts-ignore
			await this.client.sendMessage(roomID, content);
		},

		async addVote(roomId: string, inReplyTo: string, optionId: number, vote: string) {
			const content: TVotingWidgetVote = {
				msgtype: PubHubsMgType.VotingWidgetVote,
				optionId: optionId,
				vote: vote,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetVote,
				},
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetReply, content);
		},

		// Adds reaction event to an existing event based on eventId.
		// e.g., react to Message Event.
		async addReactEvent(roomId: string, eventId: string, emoji: string) {
			const content = {
				[RelationType.RelatesTo]: {
					rel_type: RelationType.Annotation,
					event_id: eventId,
					key: emoji,
				},
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, EventType.Reaction, content);
		},

		async closeVotingWidget(roomId: string, inReplyTo: string, user_ids: string[]) {
			const content: TVotingWidgetClose = {
				msgtype: PubHubsMgType.VotingWidgetClose,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetClose,
				},
				'm.mentions': {
					user_ids: user_ids,
				},
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetModify, content);
		},

		async reopenVotingWidget(roomId: string, inReplyTo: string, user_ids: string[]) {
			const content: TVotingWidgetOpen = {
				msgtype: PubHubsMgType.VotingWidgetOpen,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetOpen,
				},
				'm.mentions': {
					user_ids: user_ids,
				},
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetModify, content);
		},

		async pickOptionVotingWidget(roomId: string, inReplyTo: string, optionId: number) {
			const content: TVotingWidgetPickOption = {
				msgtype: PubHubsMgType.VotingWidgetPickOption,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetPickOption,
				},
				optionId: optionId,
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetPickOption, content);
		},

		async editPoll(roomId: string, inReplyTo: string, widget: Poll) {
			const content: TVotingWidgetEditEventContent = {
				msgtype: PubHubsMgType.VotingWidgetEdit,
				title: widget.title,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetEdit,
				},
				description: widget.description,
				options: widget.options,
				type: widget.type,
				showVotesBeforeVoting: widget.showVotesBeforeVoting,
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetModify, content);
		},

		async editScheduler(roomId: string, inReplyTo: string, widget: Scheduler) {
			const content: TVotingWidgetEditEventContent = {
				msgtype: PubHubsMgType.VotingWidgetEdit,
				title: widget.title,
				'm.relates_to': {
					event_id: inReplyTo,
					rel_type: PubHubsMgType.VotingWidgetEdit,
				},
				description: widget.description,
				location: widget.location,
				options: widget.options.filter((option) => option.status === 'filled'),
				type: widget.type,
				showVotesBeforeVoting: widget.showVotesBeforeVoting,
			};
			//@ts-ignore
			await this.client.sendEvent(roomId, PubHubsMgType.VotingWidgetModify, content);
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

		async addFile(roomId: string, threadId: string | undefined, file: File, uri: string, message: string = '', eventType: PubHubsMgType = PubHubsMgType.Default): Promise<Boolean> {
			const thread = threadId && threadId.length > 0 ? threadId : null;
			let fileType = MsgType.File;
			let body = message;
			if (body === '') body = file.name;
			if (imageTypes.includes(file?.type)) fileType = MsgType.Image;

			const content = {
				body: body,
				filename: file.name,
				info: {
					mimetype: file.type,
					size: file.size,
				},
				msgtype: fileType, // client expects string from MsgType enum, to make our own type castable send this as any
				url: uri,

				// satisfy the sdk's type checking
				'm.new_content': undefined,
				'm.relates_to': undefined,
			};
			try {
				// FileLibrary
				if (eventType === PubHubsMgType.LibraryFileMessage) {
					await this.client.sendEvent(roomId, eventType as unknown as keyof TimelineEvents, content);
				} else {
					await this.client.sendMessage(roomId, thread, content);
				}
				return true;
			} catch (error) {
				logger.trace(SMI.STORE, 'swallowing add file error', { error });
				return false;
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
				logger.trace(SMI.STORE, 'swallowing resend event error', {
					error,
				});
			}
		},

		async findUsers(term: string): Promise<Array<any>> {
			const response = await this.client.searchUserDirectory({
				term: term,
			});
			return response.results;
		},

		async getUsers(): Promise<Array<MatrixUser>> {
			if (!this.client.getUsers) {
				return [];
			}
			return this.client.getUsers();
		},

		/**
		 * Performs search on content of given room
		 *
		 * @returns the promise of searchRoomEvents or an empty promise (when no term is given)
		 */
		async searchRoomEvents(term: string, searchParameters: TSearchParameters): Promise<ISearchResults> {
			if (!term?.length) {
				const emptySearchResult: ISearchResults = {
					results: [],
					highlights: [],
				};
				return emptySearchResult;
			}

			return await this.client.searchRoomEvents({
				term: term,
				filter: { rooms: [searchParameters.roomId] },
			});
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

		async setRoomAvatar(roomId: string, url: string) {
			await this.client.sendStateEvent(roomId, EventType.RoomAvatar, { url: url }, '');
		},

		async getRoomAvatar(roomId: string) {
			return await this.client.getStateEvent(roomId, EventType.RoomAvatar, '');
		},
		// Room timestamp related functionality

		/**
		 * Fetches latest room timestamps from the API
		 */
		async fetchTimestamps(): Promise<Array<Array<number | string>>> {
			const url = `${api_synapse.apiURLS.data}?data=timestamps`;
			return await api_synapse.apiGET(url);
		},
		// Admin contact related functionality

		/**
		 * Fetches admin IDs from the API
		 */
		async fetchAdminIds(): Promise<string[]> {
			const url = `${api_synapse.apiURLS.data}?data=admin_users`;
			return await api_synapse.apiGET(url);
		},

		/**
		 * Initializes or extends admin contact room by adding hub admin members.
		 */
		async initializeOrExtendAdminContactRoom(): Promise<string | undefined> {
			const adminIds: string[] = await this.fetchAdminIds();
			if (!adminIds) return undefined;
			// Don't do anything if there are no new admins
			if (!this.hasNewAdmin(adminIds)) return this.getAdminRoomId();

			return await this.setupAdminContactRoom(adminIds);
		},

		/**
		 * Sets up the admin contact room based on existing state
		 */
		async setupAdminContactRoom(adminIds: string[]): Promise<string | undefined> {
			const existingRoom = this.findAdminContactRoom();

			if (existingRoom) {
				await this.handleExistingAdminRoom(existingRoom, adminIds);
				return existingRoom.roomId;
			} else {
				return await this.createNewAdminRoom(adminIds);
			}
		},

		/**
		 * Handles navigation to an existing admin room and invites new admins or remove them based on their admin status.
		 */
		async handleExistingAdminRoom(room: Room, adminIds: string[]): Promise<void> {
			const roomId = room.roomId;
			const newAdminId = this.findNewAdminId(adminIds);

			if (newAdminId) {
				newAdminId.forEach(async (adminId: string) => {
					if (this.hasNotBeenInvitedOrJoined(room, adminId)) {
						await this.invite(roomId, adminId);
					}
				});
			}

			const oldAdminIds = this.removeOldAdminId(adminIds);
			if (oldAdminIds) {
				oldAdminIds.forEach(async (adminId: string) => {
					if (room.getMember(adminId)?.membership === 'join') {
						await this.client.kick(roomId, adminId);
					}
				});
			}
		},

		/**
		 * Creates a new admin contact room if none exists
		 */
		async createNewAdminRoom(adminIds: string[]): Promise<string | undefined> {
			const adminUsers = adminIds.map((adminId) => this.client.getUser(adminId)).filter((user) => user !== null);

			// This condition is to satisfy the createPrivateRoomWith function - It takes either a User or MatrixUser[] as argument
			const oneOrManyAdmins = adminUsers.length === 1 ? (adminUsers.pop() as User) : adminUsers;
			const room = await this.createPrivateRoomWith(oneOrManyAdmins, true);
			// Returns room_id if it exists
			return room ? room.room_id : undefined;
		},
		/**
		 * Finds the admin contact room if it exists
		 */
		findAdminContactRoom(): Room | undefined {
			const rooms = useRooms();
			return rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		},

		/**
		 * Gets the list of existing admin member IDs from the admin contact room
		 */
		getExistingAdminMemberIds(): string[] {
			const room = this.findAdminContactRoom();

			if (!room) {
				return [];
			}
			const joinedMembers = room.getOtherJoinedMembers().map((member) => member.userId);
			const inviteMembers = room.getOtherInviteMembers().map((member) => member.userId);
			return [...joinedMembers, ...inviteMembers];
		},
		/**
		 * Finds any new admin ID that needs to be invited to the room
		 */
		findNewAdminId(adminIds: string[]): string[] | undefined {
			const existingAdminIds = this.getExistingAdminMemberIds();

			if (existingAdminIds.length >= adminIds.length) {
				return undefined;
			}
			const newAdmins = adminIds.filter((id) => !existingAdminIds.includes(id));
			return newAdmins;
		},

		/**
		 *
		 * Find  hub administrators who are no longer admins so that they can be removed from the room.
		 */
		removeOldAdminId(adminIds: string[]): string[] | undefined {
			const existingAdminIds = this.getExistingAdminMemberIds();
			if (existingAdminIds.length <= adminIds.length) {
				return undefined;
			}
			return existingAdminIds.filter((id) => !adminIds.includes(id));
		},

		/**
		 * Is Admin contact room ready
		 */
		isAdminRoomReady(): boolean {
			const rooms = useRooms();
			return rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).length != 0;
		},
		/*
		 * Get Admin Room Id
		 */
		getAdminRoomId(): string | undefined {
			return this.findAdminContactRoom()?.roomId;
		},

		/**
		 *
		 *  Check if there are new admin or not
		 */
		hasNewAdmin(adminIds: string[]): boolean {
			const existingAdminIds = this.getExistingAdminMemberIds();
			return existingAdminIds.length != adminIds.length;
		},

		hasNotBeenInvitedOrJoined(room: Room, adminId: string) {
			return !(room.getMember(adminId)?.membership === 'join' || room.getMember(adminId)?.membership === 'invite');
		},
		async routeToRoomPage(room: { room_id: string }) {
			await router.push({ name: 'room', params: { id: room.room_id } });
		},

		// Set up admin room. Corner case is that members might not have joined yet and room is available.
		// Therefore, room setup continues until room members have been joined.
		async setUpAdminRoom(): Promise<Boolean | string> {
			const rooms = useRooms();

			let room_id = await this.initializeOrExtendAdminContactRoom();
			if (!room_id) return false;

			const matrixRoomFromStore = rooms.room(room_id);
			if (!matrixRoomFromStore) return false;

			let roomMembersCount = matrixRoomFromStore.getRoomMembers();
			let attempts = 0;
			const MAX_ATTEMPTS = 10;
			while (roomMembersCount < 2 && attempts < MAX_ATTEMPTS) {
				// Intialization continues until both members have joined initially.
				room_id = await this.initializeOrExtendAdminContactRoom();
				if (!room_id) return false;
				const room = rooms.room(room_id);
				if (!room) return false;
				roomMembersCount = room.getRoomMembers();
				attempts++;
			}
			if (roomMembersCount < 2) return false; // Could not get enough members

			if (room_id && this.isAdminRoomReady()) {
				return room_id;
			}
			return false;
		},
	},
});

export type PubHubsStore = ReturnType<typeof usePubhubsStore>;

export { usePubhubsStore };
