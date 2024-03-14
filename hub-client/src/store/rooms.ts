/**
 * This store keeps the rooms of current user
 *
 * with:
 * - definition (Name)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia';
import { Room as MatrixRoom, IPublicRoomsChunkRoom, MatrixClient, RoomMember, IEvent, MatrixEvent, EventTimeline } from 'matrix-js-sdk';
import { Message, MessageType, useMessageBox } from './messagebox';
import { useRouter } from 'vue-router';
import { api_synapse, api_matrix } from '@/core/api';
import { usePubHubs } from '@/core/pubhubsStore';
import { propCompare } from '@/core/extensions';
import { YiviSigningSessionResult, AskDisclosure, AskDisclosureMessage } from '@/lib/signedMessages';
import { useUser } from './user';
import { usePlugins, PluginProperties } from './plugins';

enum PubHubsRoomType {
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
}

interface SecuredRoomAttributes {
	[index: string]: {
		profile: boolean;
		accepted_values: Array<string>;
	};
}

interface SecuredRoom {
	room_id?: string; // Will be returned by API
	name: string;
	topic?: string;
	accepted?: SecuredRoomAttributes | [];
	user_txt?: string;
	type?: string;
	expiration_time_days?: number;
	// secured?: boolean;
}

interface PublicRoom extends IPublicRoomsChunkRoom {
	user_txt?: string;
}

interface SecuredRoomAPI extends SecuredRoom {
	room_name?: string;
}

// Matrix Endpoint for messages in a room.
interface RoomMessages {
	chunk: Chunk[];
	start: string;
	end: string;
}

interface Chunk {
	type: string;
	room_id: string;
	sender: string;
	content: Content;
	origin_server_ts: number;
	unsigned: Unsigned;
	event_id: string;
	user_id: string;
	age: number;
}

interface Content {
	body: string;
	msgtype: string;
}

interface Unsigned {
	age: number;
}

/**
 *  Extending the Matrix IEvent for plugins
 */
interface Event extends IEvent {
	plugin?: PluginProperties | boolean;
}

/**
 *  Extending the MatrixRoom with some extra properties and there methods:
 *
 *      hidden : boolean        - keep track of 'removed' rooms that are not synced yet.
 *      unreadMessages : number - keep track of new messages in a room that are not read by the user.
 */

interface PubHubsRoomProperties {
	hidden: boolean;
	unreadMessages: number;
	userIsScrolling: boolean;
}

class Room extends MatrixRoom {
	_ph: PubHubsRoomProperties;

	constructor(
		public readonly roomId: string,
		public readonly client: MatrixClient,
		public readonly myUserId: string,
	) {
		super(roomId, client, myUserId);
		this._ph = {
			hidden: false,
			unreadMessages: 0,
			userIsScrolling: false,
		};
	}

	set hidden(hidden: boolean) {
		this._ph.hidden = hidden;
	}

	get hidden(): boolean {
		// Temporay hide waiting rooms. Not necessary in our own client. TODO: Remove this line after old implementation is gone.
		if (this.name.indexOf('Persoonlijke wachtkamer voor:') == 0) {
			return true;
		}
		return this._ph.hidden;
	}

	hide() {
		this._ph.hidden = true;
	}

	set unreadMessages(unread: number) {
		this._ph.unreadMessages = unread;
	}

	get unreadMessages(): number {
		return this._ph.unreadMessages;
	}

	setUserIsScrolling(isScrolling: boolean) {
		this._ph.userIsScrolling = isScrolling;
	}

	resetUnreadMessages() {
		this.unreadMessages = 0;
	}

	isPrivateRoom(): boolean {
		return this.getType() == PubHubsRoomType.PH_MESSAGES_DM;
	}

	getPrivateRoomMembers(): Array<RoomMember> {
		const me = this.client.getUserId();
		const members = this.getMembers();
		const foundMe = members.findIndex((item) => item.userId == me);
		if (foundMe >= 0) {
			members.splice(foundMe, 1);
		}
		return members;
	}

	getMemberNames(): Array<string> {
		return this.getMembers().map((item) => item.name);
	}

	getMembersIds(): Array<string> {
		let roomMemberIds = [] as Array<string>;
		// const roomMembers = this.getMembers();
		const roomMembers = this.getMembersWithMembership('join');
		roomMemberIds = roomMembers.map((item) => item.userId);
		roomMemberIds.sort();
		return roomMemberIds;
	}

	getMembersIdsFromName(): Array<string> {
		const roomMemberIds = this.name.split(',');
		roomMemberIds.sort();
		return roomMemberIds;
	}

	getOtherMembersIds(user_id: string): Array<string> {
		const roomMemberIds = this.getMembersIds();
		const foundIndex = roomMemberIds.findIndex((member_id) => member_id == user_id);
		if (foundIndex >= 0) {
			roomMemberIds.splice(foundIndex, 1);
			return roomMemberIds;
		}
		return roomMemberIds;
	}

	hasExactMembersInName(memberIds: Array<string>): boolean {
		const roomMemberIds = this.getMembersIdsFromName();
		memberIds.sort();
		return JSON.stringify(memberIds) === JSON.stringify(roomMemberIds);
	}

	notInvitedMembersIdsOfPrivateRoom(): Array<string> {
		const currentMemberIds = this.getMembersIds();
		const nameMemberIds = this.getMembersIdsFromName();
		const notInvitedMembersIds = nameMemberIds.filter((item) => currentMemberIds.indexOf(item) < 0);
		notInvitedMembersIds.sort();
		return notInvitedMembersIds;
	}

	userIsMember(user_id: string): boolean {
		const member = this.getMember(user_id);
		return member !== null;
	}

	getPowerLevel(user_id: string): Number | boolean {
		const member = this.getMember(user_id);
		if (member) {
			return member?.powerLevel;
		}
		return false;
	}

	getTopic(): string {
		const timeline = this.getLiveTimeline();
		let topic = '';
		if (timeline != undefined) {
			const topicEvent = timeline.getState(EventTimeline.FORWARDS)?.getStateEvents('m.room.topic', '');
			if (topicEvent) {
				topic = topicEvent.getContent().topic;
			}
		}
		return topic;
	}

	userCanChangeName(user_id: string): boolean {
		const member = this.getMember(user_id);
		if (member) {
			const sufficient = this.getLiveTimeline().getState(EventTimeline.FORWARDS)?.hasSufficientPowerLevelFor('redact', member?.powerLevel);
			return sufficient || false;
		}
		return false;
	}

	userCanSeeNewEvents(): boolean {
		return this._ph.userIsScrolling;
	}

	getNewestEventId(): string | undefined {
		return this.getLiveTimeline().getEvents().at(-1)?.getId();
	}

	static containsUserSentEvent(userId: string, events: MatrixEvent[]) {
		return events.some((event) => event.getSender() == userId);
	}
}

const useRooms = defineStore('rooms', {
	state: () => {
		return {
			currentRoomId: '' as string,
			rooms: {} as { [index: string]: Room },
			publicRooms: [] as Array<PublicRoom>,
			securedRooms: [] as Array<SecuredRoom>,
			roomNotices: {} as Record<string, string[]>,
			securedRoom: {} as SecuredRoom,
			askDisclosure: null as AskDisclosure | null,
			askDisclosureMessage: null as AskDisclosureMessage | null,
			newAskDisclosureMessage: false,
		};
	},

	getters: {
		roomsArray(state): Array<Room> {
			const values = Object.values(state.rooms);
			const rooms = values.filter((item) => typeof item?.roomId !== 'undefined');
			return rooms;
		},

		sortedRoomsArray(): Array<Room> {
			const rooms: Array<Room> = Object.assign([], this.roomsArray);
			rooms.sort((a, b) => (a.name > b.name ? 1 : -1));
			return rooms;
		},

		privateRooms(): Array<Room> {
			const rooms: Array<Room> = Object.assign([], this.roomsArray);
			const privateRooms = rooms.filter((item) => item.getType() == PubHubsRoomType.PH_MESSAGES_DM);
			// return privateRooms.map((item) => Object.assign({ _type: item.getType(), _members: item.getMembersWithMembership('join') }, item));
			return privateRooms;
		},

		hasRooms() {
			return this.roomsArray?.length > 0;
		},

		roomExists: (state) => {
			return (roomId: string) => {
				if (roomId) {
					return typeof state.rooms[roomId] == 'undefined' ? false : true;
				}
				return false;
			};
		},

		room: (state) => {
			return (roomId: string) => {
				if (typeof state.rooms[roomId] != 'undefined') {
					return state.rooms[roomId];
				}
				return undefined;
			};
		},

		getRoomTimeLineWithPluginsCheck: (state) => {
			return (roomId: string) => {
				if (typeof state.rooms[roomId] == 'undefined') return undefined;
				const room = state.rooms[roomId];
				const roomType = room.getType();
				const timeline = room.getLiveTimeline().getEvents();
				const plugins = usePlugins();
				const len = timeline.length;
				for (let idx = 0; idx < len; idx++) {
					const event = timeline[idx].event as unknown as Event;
					event.plugin = false;
					const hasEventPlugin = plugins.hasEventPlugin(event, roomId, roomType);
					if (hasEventPlugin) {
						event.plugin = hasEventPlugin;
					} else {
						const hasEventMessagePlugin = plugins.hasEventMessagePlugin(event, roomId, roomType);
						if (hasEventMessagePlugin) {
							event.plugin = hasEventMessagePlugin;
						}
					}
					timeline[idx].event = event as any;
				}
				return timeline;
			};
		},

		getRoomTopic: (state) => {
			return (roomId: string) => {
				if (typeof state.rooms[roomId] == 'undefined') return '';
				const room = state.rooms[roomId];
				return room.getTopic();
			};
		},

		currentRoom(state): Room | undefined {
			if (state.rooms[state.currentRoomId]) {
				return state.rooms[state.currentRoomId];
			}
			return undefined;
		},

		currentRoomHasEvents(state): Boolean {
			const currentRoom = this.currentRoom;
			if (currentRoom) {
				return state.rooms[state.currentRoomId].getLiveTimeline().getEvents().length > 0;
			}
			return false;
		},

		currentRoomExists(state): boolean {
			return this.roomExists(state.currentRoomId);
		},

		hasPublicRooms(state): boolean {
			return Object.keys(state.publicRooms).length > 0;
		},

		nonSecuredPublicRooms(state): Array<PublicRoom> {
			return state.publicRooms.filter((room: PublicRoom) => {
				return typeof room.room_type == 'undefined' || room.room_type !== PubHubsRoomType.PH_MESSAGES_RESTRICTED;
			});
		},

		visiblePublicRooms(state): Array<PublicRoom> {
			return state.publicRooms.filter((room: PublicRoom) => {
				if (this.roomExists(room.room_id) && !this.room(room.room_id)?._ph.hidden) {
					return false;
				}
				return true;
			});
		},

		privateRoomWithMembersExist() {
			return (memberIds: Array<string>): boolean | string => {
				for (let index = 0; index < this.privateRooms.length; index++) {
					const room = this.privateRooms[index];
					if (room.hasExactMembersInName(memberIds)) {
						return room.roomId;
					}
				}
				return false;
			};
		},

		hasSecuredRooms(state): boolean {
			return Object.keys(state.securedRooms).length > 0;
		},

		sortedSecuredRooms(state): Array<SecuredRoom> {
			return state.securedRooms.sort(propCompare('room_name'));
		},

		totalUnreadMessages() {
			let total = 0;
			for (const idx in this.roomsArray) {
				const room = this.roomsArray[idx];

				if (!room.hidden) {
					total += room.unreadMessages;
				}
			}
			return total;
		},
	},

	actions: {
		// On receiving a message in any room:
		onModRoomMessage(roomId: string, e: MatrixEvent) {
			// On receiving a moderation "Ask Disclosure" message (in any room),
			// addressed to the current user,
			// put the details into the state store to start the Disclosure flow.
			if (e.event?.type == 'm.room.message' && e.event.content?.msgtype == 'pubhubs.ask_disclosure_message') {
				const user = useUser();
				const ask = e.event.content.ask_disclosure_message as AskDisclosureMessage;
				if (ask.userId == user.user.userId) {
					console.debug(`rx pubhubs.ask_disclosure_message([${ask.attributes.map((a) => (a as any).yivi)}]) to ${ask.userId} (THIS user)`);
					this.askDisclosureMessage = ask;
					this.newAskDisclosureMessage = true;
				} else {
					console.debug(`rx pubhubs.ask_disclosure_message([${ask.attributes.map((a) => (a as any).yivi)}]) to ${ask.userId} (NOT this user)`);
				}
			}
		},

		changeRoom(roomId: string) {
			if (this.currentRoomId !== roomId) {
				this.currentRoomId = roomId;
				if (roomId != '' && this.rooms[roomId]) {
					this.rooms[roomId].resetUnreadMessages();
					this.sendUnreadMessageCounter();
				}
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.RoomChange, roomId));
			}
		},

		updateRoomsWithMatrixRooms(rooms: MatrixRoom[]) {
			this.rooms = {} as { [index: string]: Room }; // reset rooms
			for (const idx in rooms) {
				//? What does this check?
				if (Object.hasOwnProperty.call(rooms, idx) && rooms[idx].getMyMembership() == 'join') {
					this.addMatrixRoom(rooms[idx]);
				}
			}
		},

		addMatrixRoom(matrixRoom: MatrixRoom) {
			const room = Object.assign(new Room(matrixRoom.roomId, matrixRoom.client, matrixRoom.myUserId), matrixRoom);
			this.addRoom(room);
		},

		addRoom(room: Room) {
			// maybe rooms exists allready and is written over, then prepare the PubHubs specific room properties
			if (this.roomExists(room.roomId)) {
				room.hidden = this.rooms[room.roomId].hidden;
				room.unreadMessages = this.rooms[room.roomId].unreadMessages;
			}
			this.rooms[room.roomId] = Object.assign(new Room(room.roomId, room.client, room.myUserId), room);
		},

		sendUnreadMessageCounter() {
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.UnreadMessages, this.totalUnreadMessages));
		},

		// This will give the latest timestamp of the receipt i.e., recent read receipt TS.
		getReceiptForUserId(roomId: string, userId: string) {
			const mEvents = this.rooms[roomId]
				.getLiveTimeline()
				.getEvents()
				.filter((event) => event.event.type === 'm.receipt' && event.event.sender === userId)
				.map((event) => event.localTimestamp);

			const storedTS = localStorage.getItem('receiptTS');
			const tsData = storedTS ? JSON.parse(storedTS) : null;

			if (tsData && tsData instanceof Array) {
				// Find the timestamp for the specified roomId
				const roomTimestamp = tsData.find((data) => data.roomId === roomId)?.timestamp;

				// Return the latest timestamp, considering both local events and stored data
				return roomTimestamp ? Math.max(...mEvents, roomTimestamp) : Math.max(...mEvents);
			}

			return Math.max(...mEvents);
		},

		getLatestEvents(roomId: string) {
			let localMatrixEvent: MatrixEvent[] = [];

			// Compare the timstamp from last event and check if timestamp of receipt is less than the events of message type.
			// We don't want to mess up the original timeline by
			localMatrixEvent = Object.assign(localMatrixEvent, this.rooms[roomId].getLiveTimeline().getEvents());

			// To get the latest timestamp of message - from the bottom to avoid going through all the events.
			// until the latest receipt timestamp.
			return localMatrixEvent.reverse();
		},

		// This method can be useful to make decisions based on last event.
		// For example, who send the message.
		// Last time of an event.
		getlastEvent(roomId: string) {
			return this.getLatestEvents(roomId)[0];
		},

		unreadMessageCounter(roomId: string, singleEvent: MatrixEvent): void {
			const user = useUser();
			const receiptTS = this.getReceiptForUserId(roomId, user.user.userId);

			if (singleEvent === undefined) {
				// Always initialize to remove any inaccuracies due to caching before counting unread messages.
				let messageCounter = 0;
				this.rooms[roomId].resetUnreadMessages();

				// Counting from the latest message.
				const reverseTimeLine = this.getLatestEvents(roomId);
				for (const latestEvent of reverseTimeLine) {
					if (receiptTS < latestEvent.localTimestamp && latestEvent.event.sender !== user.user.userId) {
						if (latestEvent.getType() === 'm.room.message') {
							if (latestEvent.event.content?.['m.mentions'] !== undefined) {
								if (latestEvent.event.content?.['m.mentions'].user_ids !== undefined) {
									if (this.unreadMentionMsgCount(latestEvent)) {
										messageCounter = ++messageCounter;
									}
								}
							} else {
								messageCounter = ++messageCounter;
							}
						}
					} else if (receiptTS > latestEvent.localTimestamp && latestEvent.event.sender !== user.user.userId) {
						this.rooms[roomId]._ph.unreadMessages += messageCounter;
						// Send this to the global client
						this.sendUnreadMessageCounter();
						break;
					}
				}
			} else {
				if (receiptTS < singleEvent.localTimestamp && singleEvent.event.sender !== user.user.userId) {
					if (singleEvent.event.content?.['m.mentions']?.['user_ids'] !== undefined && singleEvent.event.content['m.mentions']['user_ids'].length > 0) {
						// Only if 'this' user is mentioned then count. If other users are mentioned then don't count.
						if (this.unreadMentionMsgCount(singleEvent)) {
							this.rooms[roomId]._ph.unreadMessages += 1;
							this.sendUnreadMessageCounter();
						}
					} else {
						// If there is no mention for this user, but we have a new message, still count.
						this.rooms[roomId]._ph.unreadMessages += 1;
						this.sendUnreadMessageCounter();
					}
				}
			}
		},

		unreadMentionMsgCount(currentMsgEvent: MatrixEvent) {
			const user = useUser();

			let onlyPseudonymInLogUser = '';
			// It is a string so better to convert it to an array of mentions.
			// It could be a single string or an array of strings. Hencce we convert it to an array.
			//@ts-ignore
			const userIdsInMention: string[] = currentMsgEvent.event.content?.['m.mentions'].user_ids.includes(',')
				? //@ts-ignore
					currentMsgEvent.event.content?.['m.mentions'].user_ids.split(',')
				: //@ts-ignore
					[currentMsgEvent.event.content?.['m.mentions'].user_ids];

			const loggedInUserInMention = user.user.displayName!;
			// XXX: Another check for handling display name with pseudonym issue.
			// Sometimes display name when changing doesn't update properly. In the meantime, someone might mention the user.
			if (loggedInUserInMention.startsWith('@')) {
				// We extract only pesudonym. If display name is not returned.
				// XXX: Tightly coupled with pseudonym format.
				onlyPseudonymInLogUser = loggedInUserInMention.substring(1, 7);
			}
			// Only only if you are mentioned!
			for (const element of userIdsInMention) {
				if (element[0] !== undefined) {
					if (loggedInUserInMention === element[0] || element[0].includes(onlyPseudonymInLogUser)) {
						return true;
					}
				}
			}

			return false;
		},
		async fetchPublicRooms() {
			const pubhubs = usePubHubs();
			const response = await pubhubs.getAllPublicRooms();
			const rooms = response.chunk as [];
			this.publicRooms = rooms.sort(propCompare('name'));
		},

		roomIsSecure(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: PublicRoom) => room.room_id == roomId) as unknown as PublicRoom;
			if (publicRoom) {
				if (publicRoom.room_type && publicRoom.room_type == 'ph.messages.restricted') {
					return true;
				}
			}
			return false;
		},

		getRoomCreator(roomId: string): string | null {
			return this.rooms[roomId].getCreator();
		},

		//? Some documentation would be helpful here.
		async storeRoomNotice(roomId: string) {
			try {
				const hub_notice = await api_synapse.apiGET<string>(api_synapse.apiURLS.notice);
				const encodedObject = encodeURIComponent(JSON.stringify({ types: ['m.room.message'], senders: [hub_notice] }));
				const response = await api_matrix.apiGET<RoomMessages>(api_matrix.apiURLS.rooms + roomId + '/messages?filter=' + encodedObject);
				for (const chunk of response.chunk) {
					if (!this.roomNotices[roomId]) {
						this.roomNotices[roomId] = [];
					}
					this.roomNotices[roomId].push(chunk.content.body);
				}
			} catch (error) {
				console.log(error);
			}
		},

		// Needs Admin token
		async fetchSecuredRooms() {
			const result = await api_synapse.apiGET<Array<SecuredRoomAPI>>(api_synapse.apiURLS.securedRooms);
			this.securedRooms = result;
		},

		// Non-Admin api for getting information about an individual secured room based on room ID.
		async getSecuredRoomInfo(roomId: string) {
			const jsonInString = await api_synapse.apiGET<string>(api_synapse.apiURLS.securedRoom + '?room_id=' + roomId);
			this.securedRoom = JSON.parse(jsonInString);
		},

		async addSecuredRoom(room: SecuredRoom) {
			const newRoom = await api_synapse.apiPOST<SecuredRoom>(api_synapse.apiURLS.securedRooms, room);
			this.securedRooms.push(newRoom);
			this.fetchPublicRooms(); // Reset PublicRooms, so the new room is indeed recognised as a secured room. TODO: could this be improved without doing a fetch?
			return newRoom;
		},

		async changeSecuredRoom(room: SecuredRoom) {
			const response = await api_synapse.apiPUT<any>(api_synapse.apiURLS.securedRooms, room);
			const modified_id = response.modified;
			const pidx = this.securedRooms.findIndex((room) => room.room_id == modified_id);
			if (pidx >= 0) {
				this.securedRooms[pidx] = room;
			}
			return modified_id;
		},

		// See https://matrix-org.github.io/synapse/latest/admin_api/rooms.html#version-2-new-version
		async removePublicRoom(room_id: string) {
			const body = {
				block: true,
				purge: true,
			};

			// const response_notice = await this.getRoomNotice(room_id)
			// for (const content of response_notice.chunk){
			// 	console.info(content.content.body)
			// }
			const response = await api_synapse.apiDELETE<any>(api_synapse.apiURLS.deleteRoom + room_id, body);

			const deleted_id = response.delete_id;
			this.room(room_id)?.hide();

			const pidx = this.publicRooms.findIndex((room) => room.room_id == room_id);
			this.publicRooms.splice(pidx, 1);
			return deleted_id;
		},

		async removeSecuredRoom(room: SecuredRoom) {
			const response = await api_synapse.apiDELETE<any>(api_synapse.apiURLS.securedRooms + '?room_id=' + room.room_id);
			const deleted_id = response.deleted;
			const sidx = this.securedRooms.findIndex((room) => room.room_id == deleted_id);
			this.securedRooms.splice(sidx, 1);
			const pidx = this.publicRooms.findIndex((room) => room.room_id == deleted_id);
			this.publicRooms.splice(pidx, 1);
			this.room(deleted_id)?.hide();
			return deleted_id;
		},

		yiviSecuredRoomflow(roomId: string, authToken: string) {
			const router = useRouter();
			const pubhubs = usePubHubs();

			pubhubs
				.joinRoom(roomId)
				.then((res) => {
					console.debug(res);
					router.push({ name: 'room', params: { id: roomId } });
				})
				.catch((err) => {
					console.debug(err);
					const yivi = require('@privacybydesign/yivi-frontend');
					// @ts-ignore
					const urlll = _env.HUB_URL + '/_synapse/client/ph';
					const yiviWeb = yivi.newWeb({
						debugging: false,
						element: '#yivi-web-form',
						language: 'en',

						session: {
							url: 'yivi-endpoint',

							start: {
								url: () => {
									return `${urlll}/yivi-endpoint/start?room_id=${roomId}`;
								},
								method: 'GET',
							},
							result: {
								url: (o: any, obj: any) => `${urlll}/yivi-endpoint/result?session_token=${obj.sessionToken}&room_id=${roomId}`,
								method: 'GET',
								headers: {
									Authorization: `Bearer ${authToken}`,
								},
							},
						},
					});

					yiviWeb
						.start()
						.then((result: any) => {
							if (result.not_correct) {
								router.push({ name: 'error-page-room', params: { id: roomId } });
							} else if (result.goto) {
								pubhubs.updateRooms();
								router.push({ name: 'room', params: { id: roomId } });
							}
						})
						.catch((error: any) => {
							console.info(`There is an Error: ${error}`);
						});
				});
		},

		yiviSignMessage(message: string, attributes: string[], roomId: string, authToken: string, onFinish: (result: YiviSigningSessionResult) => unknown) {
			const yivi = require('@privacybydesign/yivi-frontend');
			// @ts-ignore
			const urlll = _env.HUB_URL + '/_synapse/client/ph';
			const yiviWeb = yivi.newWeb({
				debugging: false,
				element: '#yivi-web-form',
				language: 'en',

				session: {
					url: 'yivi-endpoint',

					start: {
						url: () => {
							return `${urlll}/yivi-endpoint/start?room_id=${roomId}`;
						},
						method: 'POST',
						body: JSON.stringify({
							'@context': 'https://irma.app/ld/request/signature/v2',
							disclose: [[attributes]],
							message: message,
						}),
					},
					result: {
						url: (o: any, obj: any) => `${urlll}/yivi-endpoint/result?session_token=${obj.sessionToken}`,
						method: 'POST',
						headers: {
							Authorization: `Bearer ${authToken}`,
						},
					},
				},
			});

			yiviWeb
				.start()
				.then((result: YiviSigningSessionResult) => {
					onFinish(result);
				})
				.catch((error: any) => {
					console.info(`There is an Error: ${error}`);
				});
		},

		yiviAskDisclosure(message: string, attributes: string[], roomId: string, authToken: string, onFinish: (result: YiviSigningSessionResult) => unknown) {
			console.log(`yiviAskDisclosure: '${message}', attributes=[${attributes}], ${roomId}, token=${authToken}`);

			const yivi = require('@privacybydesign/yivi-frontend');
			// @ts-ignore
			const urlll = _env.HUB_URL + '/_synapse/client/ph';
			const yiviWeb = yivi.newWeb({
				debugging: true, // ### TODO
				element: '#yivi-web-form-2',
				language: 'en',

				session: {
					url: 'yivi-endpoint',

					start: {
						url: () => {
							return `${urlll}/yivi-endpoint/start?room_id=${roomId}`;
						},
						method: 'POST',
						body: JSON.stringify({
							'@context': 'https://irma.app/ld/request/signature/v2',
							disclose: [[attributes]],
							message: message,
						}),
					},
					result: {
						url: (o: any, obj: any) => `${urlll}/yivi-endpoint/result?session_token=${obj.sessionToken}`,
						method: 'POST',
						headers: {
							Authorization: `Bearer ${authToken}`,
						},
					},
				},
			});

			yiviWeb
				.start()
				.then((result: YiviSigningSessionResult) => {
					onFinish(result);
				})
				.catch((error: any) => {
					console.info(`There is an Error: ${error}`);
				});
		},
	},
});

export { PubHubsRoomType, Event, Room, RoomMember, PublicRoom, SecuredRoomAttributes, SecuredRoom, useRooms };
