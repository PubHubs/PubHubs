import { api_matrix, api_synapse } from '@/logic/core/api';
import { propCompare } from '@/logic/core/extensions';
import { usePubHubs } from '@/logic/core/pubhubsStore';
import { AskDisclosure, AskDisclosureMessage, YiviSigningSessionResult } from '@/model/components/signedMessages';
import Room from '@/model/rooms/Room';
import { RoomType } from '@/model/rooms/TBaseRoom';
import { TPublicRoom } from '@/model/rooms/TPublicRoom';
import { TSecuredRoom } from '@/model/rooms/TSecuredRoom';
import { EventType, MatrixEvent, Room as MatrixRoom, NotificationCountType } from 'matrix-js-sdk';
import { defineStore } from 'pinia';
import { Message, MessageType, useMessageBox } from './messagebox';
import { useUser } from './user';
import { useSettings } from './settings';
import { PubHubsMgType } from '@/logic/core/events';
import { SecuredRoomAttributeResult } from '@/logic/foundation/statusTypes';

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

function validSecuredRoomAttributes(room: TSecuredRoom): boolean {
	// Note that it is allowed to have no attribute values for an attribute type.
	// So that that the attribute is required but all values are allowed.
	if (!room.accepted) {
		return false;
	}

	const hasEmptyAttributeType = Object.keys(room.accepted).some((key) => key === '');
	if (hasEmptyAttributeType) return false;

	return true;
}

const useRooms = defineStore('rooms', {
	state: () => {
		return {
			currentRoomId: '' as string,
			publicRoomsLoaded: false as boolean,
			rooms: {} as { [index: string]: Room },
			roomsSeen: {} as { [index: string]: number },
			publicRooms: [] as Array<TPublicRoom>,
			securedRooms: [] as Array<TSecuredRoom>,
			roomNotices: {} as { [room_id: string]: { [user_id: string]: string[] } },
			securedRoom: {} as TSecuredRoom,
			askDisclosure: null as AskDisclosure | null,
			askDisclosureMessage: null as AskDisclosureMessage | null,
			newAskDisclosureMessage: false,
		};
	},

	getters: {
		/**
		 *  Returns roomsLoaded: all rooms are loaded AND all rooms have a name that is different from the roomId.
		 *  Rooms can be added with the Id as name (the initial value) and only when syncing these rooms get their calculated name,
		 *  so we check for that
		 */
		roomsLoaded(state): boolean {
			const values = Object.values(state.rooms);
			return this.publicRoomsLoaded && !values.some((room) => room.roomId === room.name);
		},

		roomsArray(state): Array<Room> {
			const values = Object.values(state.rooms);
			// check if the room has an Id and if the Id is different from the name (because then the Id would be displayed and the room unreachable)
			const rooms = values.filter((room) => typeof (room.roomId !== 'undefined') && room.roomId !== room.name);
			return rooms;
		},

		sortedRoomsArrayByJoinedTime(): Array<Room> {
			const user = useUser();
			const rooms: Array<Room> = Object.assign([], this.roomsArray);
			rooms.sort((a, b) => {
				const aJoined = a.getMember(user.userId!)?.getLastModifiedTime();
				const bJoined = b.getMember(user.userId!)?.getLastModifiedTime();
				return aJoined! < bJoined! ? 1 : -1;
			});
			return rooms;
		},

		sortedRoomsArray(): Array<Room> {
			const rooms: Array<Room> = Object.assign([], this.roomsArray);
			rooms.sort((a, b) => (a.name > b.name ? 1 : -1));
			return rooms;
		},

		privateRooms(): Array<Room> {
			const rooms: Array<Room> = Object.assign([], this.roomsArray);
			const privateRooms = rooms.filter((item) => item.getType() == RoomType.PH_MESSAGES_DM);
			return privateRooms;
		},

		hasRooms(): boolean {
			return this.roomsArray?.length > 0;
		},

		roomExists: (state) => {
			return (roomId: string) => {
				if (roomId) {
					return typeof state.rooms[roomId] === 'undefined' ? false : true;
				}
				return false;
			};
		},

		room: (state) => {
			return (roomId: string): Room | undefined => {
				if (typeof state.rooms[roomId] !== 'undefined') {
					return state.rooms[roomId];
				}
				return undefined;
			};
		},

		getRoomTopic: (state) => {
			return (roomId: string) => {
				if (typeof state.rooms[roomId] === 'undefined') return '';
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

		currentRoomExists(state): boolean {
			return this.roomExists(state.currentRoomId);
		},

		hasPublicRooms(state): boolean {
			return Object.keys(state.publicRooms).length > 0;
		},

		nonSecuredPublicRooms(state): Array<TPublicRoom> {
			return state.publicRooms.filter((room: TPublicRoom) => {
				return typeof room.room_type === 'undefined' || room.room_type !== RoomType.PH_MESSAGES_RESTRICTED;
			});
		},

		visiblePublicRooms(state): Array<TPublicRoom> {
			return state.publicRooms.filter((room: TPublicRoom) => {
				if (this.room(room.room_id)?.isHidden()) {
					return false;
				}
				return true;
			});
		},

		hasSecuredRooms(state): boolean {
			return Object.keys(state.securedRooms).length > 0;
		},

		sortedSecuredRooms(state): Array<TSecuredRoom> {
			return state.securedRooms.sort(propCompare('room_name'));
		},

		totalUnreadMessages() {
			let total = 0;
			this.roomsArray.forEach((room) => {
				if (!room.isHidden()) {
					total += room.getRoomUnreadNotificationCount(NotificationCountType.Total);
				}
			});
			return total;
		},
	},

	actions: {
		// On receiving a message in any room:
		onModRoomMessage(e: MatrixEvent) {
			// On receiving a moderation "Ask Disclosure" message (in any room),
			// addressed to the current user,
			// put the details into the state store to start the Disclosure flow.
			if (e.event?.type === EventType.RoomMessage && e.event.content?.msgtype === PubHubsMgType.AskDisclosureMessage) {
				const user = useUser();
				const ask = e.event.content.ask_disclosure_message as AskDisclosureMessage;
				if (ask.userId === user.userId!) {
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
				const messagebox = useMessageBox();
				messagebox.sendMessage(new Message(MessageType.RoomChange, roomId));
			}
		},

		// add one room to the store
		updateRoomsWithMatrixRoom(matrixRoom: MatrixRoom, roomName: string | undefined) {
			if (!this.rooms[matrixRoom.roomId]) {
				this.rooms[matrixRoom.roomId] = new Room(matrixRoom);
				if (roomName) {
					this.rooms[matrixRoom.roomId].name = roomName;
				}
			}
		},

		// replace the current rooms in the store with the new ones
		updateRoomsWithMatrixRooms(matrixRoomArray: MatrixRoom[]) {
			// Remove every room that is in this.rooms, but not in matrixRoomArray
			const matrixRoomIds = new Set(matrixRoomArray.map((room) => room.roomId));
			const filteredRooms: { [index: string]: Room } = {};
			for (const key in this.rooms) {
				const room = this.rooms[key];
				if (matrixRoomIds.has(room.roomId)) {
					filteredRooms[key] = room;
				}
			}
			this.rooms = filteredRooms;

			// then add the new rooms from matrixRoomArray
			matrixRoomArray.forEach((matrixRoom) => {
				// Check if room already exists else add room
				if (!this.rooms[matrixRoom.roomId]) {
					this.rooms[matrixRoom.roomId] = new Room(matrixRoom);
				}
			});
			this.publicRoomsLoaded = true;
		},

		setPublicRoomsLoaded(loading: boolean) {
			this.publicRoomsLoaded = loading;
		},

		sendUnreadMessageCounter() {
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.UnreadMessages, this.totalUnreadMessages));
		},

		unreadMessageNotification(): number {
			if (!this.currentRoom) return 0;
			return this.currentRoom.getRoomUnreadNotificationCount(NotificationCountType.Total);
		},

		unreadMentionNotification(): number {
			if (!this.currentRoom) return 0;
			return this.currentRoom.getRoomUnreadNotificationCount(NotificationCountType.Highlight);
		},

		async fetchPublicRooms() {
			const pubhubs = usePubHubs();
			const rooms = await pubhubs.getAllPublicRooms();
			this.publicRooms = rooms.sort(propCompare('name'));
		},

		memberOfPublicRoom(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
			if (!publicRoom) return false;
			const foundIndex = this.roomsArray.findIndex((room) => room.roomId === publicRoom?.room_id);
			return foundIndex >= 0;
		},

		roomIsSecure(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
			return publicRoom?.room_type === RoomType.PH_MESSAGES_RESTRICTED;
		},

		//? Some documentation would be helpful here.
		async storeRoomNotice(roomId: string) {
			const hub_notice = await api_synapse.apiGET<string>(api_synapse.apiURLS.notice);
			const creatingAdminUser = this.currentRoom?.getCreator();
			if (!this.roomNotices[roomId]) {
				this.roomNotices[roomId] = {};
			}

			if (creatingAdminUser) {
				this.roomNotices[roomId][creatingAdminUser!] = ['rooms.admin_badge'];
			}
			const limit = 100000;
			const encodedObject = encodeURIComponent(JSON.stringify({ types: [EventType.RoomMessage], senders: [hub_notice], limit: limit }));
			// The limit is in two places, it used to work in just the filter, but not anymore. It's also an option in the query string.
			const response = await api_matrix.apiGET<RoomMessages>(api_matrix.apiURLS.rooms + roomId + `/messages?limit=${limit}&filter=` + encodedObject);
			for (const message of response.chunk) {
				const body = message.content.body;
				this.addProfileNotice(roomId, body);
			}
		},

		addProfileNotice(roomId: string, body: string) {
			const user_id = body.split(' ', 1)[0];
			let attributes: string[] = Object.values(JSON.parse(body.split('joined the room with attributes', 2)[1].trim().replaceAll("'", '"')));
			attributes = attributes.filter((x) => x !== '');
			if (!this.roomNotices[roomId]) {
				this.roomNotices[roomId] = {};
			}
			this.roomNotices[roomId][user_id] = attributes;
		},

		// Needs Admin token
		async fetchSecuredRooms() {
			const result = await api_synapse.apiGET<Array<TSecuredRoom>>(api_synapse.apiURLS.securedRooms);
			this.securedRooms = result;
		},

		// Non-Admin api for getting information about an individual secured room based on room ID.
		async getSecuredRoomInfo(roomId: string) {
			const jsonInString = await api_synapse.apiGET<string>(api_synapse.apiURLS.securedRoom + '?room_id=' + roomId);
			this.securedRoom = JSON.parse(jsonInString);
		},

		async addSecuredRoom(room: TSecuredRoom) {
			if (!validSecuredRoomAttributes(room)) {
				throw new Error('errors.no_valid_attribute');
			}
			const newRoom = await api_synapse.apiPOST<TSecuredRoom>(api_synapse.apiURLS.securedRooms, room);
			this.securedRooms.push(newRoom);
			this.fetchPublicRooms(); // Reset PublicRooms, so the new room is indeed recognised as a secured room. TODO: could this be improved without doing a fetch?
			const pubhubs = usePubHubs();
			pubhubs.joinRoom(newRoom.room_id);
			return { result: newRoom };
		},

		async changeSecuredRoom(room: TSecuredRoom) {
			if (!validSecuredRoomAttributes(room)) {
				throw new Error('errors.no_valid_attribute');
			}
			const response = await api_synapse.apiPUT<any>(api_synapse.apiURLS.securedRooms, room);
			const modified_id = response.modified;
			const pidx = this.securedRooms.findIndex((room) => room.room_id === modified_id);
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
			const response = await api_synapse.apiDELETE<any>(api_synapse.apiURLS.roomsAPIV2 + room_id, body);

			const deleted_id = response.delete_id;
			this.room(room_id)?.setHidden(true);

			const pidx = this.publicRooms.findIndex((room) => room.room_id === room_id);
			this.publicRooms.splice(pidx, 1);
			return deleted_id;
		},

		async removeSecuredRoom(room: TSecuredRoom) {
			const response = await api_synapse.apiDELETE<any>(api_synapse.apiURLS.securedRooms + '?room_id=' + room.room_id);
			const deleted_id = response.deleted;
			const sidx = this.securedRooms.findIndex((room) => room.room_id === deleted_id);
			this.securedRooms.splice(sidx, 1);
			const pidx = this.publicRooms.findIndex((room) => room.room_id === deleted_id);
			this.publicRooms.splice(pidx, 1);
			this.room(deleted_id)?.setHidden(true);
			return deleted_id;
		},

		yiviSecuredRoomflow(roomId: string, onFinish: (result: SecuredRoomAttributeResult) => unknown) {
			//

			require('../../assets/yivi.min.css');
			//
			const yiviCore = require('@privacybydesign/yivi-core');
			//
			const yiviWeb = require('@privacybydesign/yivi-web');
			//
			const yiviClient = require('@privacybydesign/yivi-client');

			const pubhubs = usePubHubs();
			const settings = useSettings();

			const accessToken = pubhubs.Auth.getAccessToken();
			if (!accessToken) throw new Error('Access token missing.');

			// @ts-ignore
			const urlll = _env.HUB_URL + '/_synapse/client/ph';
			const yivi = new yiviCore({
				debugging: false,
				element: '#yivi-login',
				language: settings.getActiveLanguage,

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
							Authorization: `Bearer ${accessToken}`,
						},
					},
				},
			});

			yivi.use(yiviWeb);
			yivi.use(yiviClient);

			yivi.start()
				.then((result: SecuredRoomAttributeResult) => {
					onFinish(result);
				})
				.catch((error: any) => {
					console.info(`There is an Error: ${error}`);
				});
		},

		yiviSignMessage(message: string, attributes: string[], roomId: string, accessToken: string, onFinish: (result: YiviSigningSessionResult) => unknown) {
			const settings = useSettings();

			const yivi = require('@privacybydesign/yivi-frontend');
			// @ts-ignore
			const urlll = _env.HUB_URL + '/_synapse/client/ph';
			const yiviWeb = yivi.newWeb({
				debugging: false,
				element: '#yivi-web-form',
				language: settings.getActiveLanguage,

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
							Authorization: `Bearer ${accessToken}`,
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

		yiviAskDisclosure(message: string, attributes: string[], roomId: string, onFinish: (result: YiviSigningSessionResult) => unknown) {
			console.log(`yiviAskDisclosure: '${message}', attributes=[${attributes}], ${roomId}`);

			const settings = useSettings();
			const pubhubsStore = usePubHubs();

			const accessToken = pubhubsStore.Auth.getAccessToken();
			if (!accessToken) throw new Error('Access token missing.');

			const yivi = require('@privacybydesign/yivi-frontend');
			// @ts-ignore
			const urlll = _env.HUB_URL + '/_synapse/client/ph';
			const yiviWeb = yivi.newWeb({
				debugging: true, // ### TODO
				element: '#yivi-web-form-2',
				language: settings.getActiveLanguage,

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
							Authorization: `Bearer ${accessToken}`,
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

		// Get specific TPublic or TSecured Room - The structure of the room is different from MatrixRoom.
		async getTPublicOrTSecuredRoom(roomId: string) {
			const isSecuredRoom = this.roomIsSecure(roomId);
			if (isSecuredRoom) {
				// Fetch secured Room
				await this.getSecuredRoomInfo(roomId);
				// Set the current Secured Room
				return this.securedRoom;
			} else {
				// We need to get information from TPublicRoom instead of room.
				return this.publicRooms.find((room) => room.room_id == this.currentRoomId)!;
			}
		},
	},
});

export { type TEvent } from '@/model/events/TEvent';
export { type TPublicRoom } from '@/model/rooms/TPublicRoom';
export { type TRoomMember } from '@/model/rooms/TRoomMember';
export { type SecuredRoomAttributes, type TSecuredRoom } from '@/model/rooms/TSecuredRoom';
export { type TUser } from '@/model/users/TUser';
export { Room, RoomType, useRooms };
