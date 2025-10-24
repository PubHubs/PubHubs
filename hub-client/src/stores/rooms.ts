// Packages
import { EventType, IStateEvent, MatrixEvent, Room as MatrixRoom, NotificationCountType, RoomMember } from 'matrix-js-sdk';
import { MSC3575RoomData as SlidingSyncRoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { defineStore } from 'pinia';

// Logic
import { api_matrix, api_synapse } from '@hub-client/logic/core/api';
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { propCompare } from '@hub-client/logic/core/extensions';
import { isVisiblePrivateRoom } from '@hub-client/logic/core/privateRoomNames';
import { CONFIG } from '@hub-client/logic/logging/Config';
import { SecuredRoomAttributeResult } from '@hub-client/logic/logging/statusTypes';

// Models
import { AskDisclosure, AskDisclosureMessage, YiviSigningSessionResult } from '@hub-client/models/components/signedMessages';
import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
import Room from '@hub-client/models/rooms/Room';
import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
import { TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useSettings } from '@hub-client/stores/settings';
import { useUser } from '@hub-client/stores/user';

// Types
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

interface RoomListRoom {
	roomId: string;
	roomType: string;
	name: string;
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
			rooms: {} as { [index: string]: Room },
			roomsSeen: {} as { [index: string]: number },
			roomList: [] as Array<RoomListRoom>,
			publicRooms: [] as Array<TPublicRoom>,
			securedRooms: [] as Array<TSecuredRoom>,
			roomNotices: {} as { [room_id: string]: { [user_id: string]: string[] } },
			securedRoom: {} as TSecuredRoom,
			askDisclosure: null as AskDisclosure | null,
			askDisclosureMessage: null as AskDisclosureMessage | null,
			newAskDisclosureMessage: false,
			initialRoomsLoaded: false,
			timestamps: [] as Array<Array<Number | string>>,
		};
	},

	getters: {
		/**
		 *  Returns roomsLoaded: all rooms are loaded AND all rooms have a name that is different from the roomId.
		 *  Rooms can be added with the Id as name (the initial value) and only when syncing these rooms get their calculated name,
		 *  so we check for that
		 */
		roomsLoaded(state): boolean {
			return state.initialRoomsLoaded;
		},

		roomsArray(state): Array<Room> {
			const values = Object.values(state.rooms);
			// check if the room has an Id and if the Id is different from the name (because then the Id would be displayed and the room unreachable)
			const rooms = values.filter((room) => typeof room.roomId !== 'undefined' && room.roomId !== room.name);
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
		roomtimestamps(state): Array<Array<Number | string>> {
			return state.timestamps;
		},
	},

	actions: {
		setRoomsLoaded(value: boolean) {
			this.initialRoomsLoaded = value;
		},
		setTimestamps(timestamps: Array<Array<Number | string>>) {
			this.timestamps = timestamps;
		},

		loadFromSlidingSync(roomId: string, roomData: SlidingSyncRoomData) {
			if (this.rooms[roomId]) {
				this.rooms[roomId].loadFromSlidingSync(roomData);
			}
		},

		fetchRoomById(roomId: string): Room | undefined {
			return this.room(roomId);
		},

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

		updateRoomList(roomId: string, name: string, type: string) {
			if (!this.roomList.find((room) => room.roomId === roomId)) {
				this.roomList.push({ roomId: roomId, roomType: type, name: name });
			}
		},

		// add one room to the store upon initializing PubHubs
		initRoomsWithMatrixRoom(matrixRoom: MatrixRoom, roomName: string | undefined, roomType: string, stateEvents: IStateEvent[]) {
			if (!this.rooms[matrixRoom.roomId]) {
				this.rooms[matrixRoom.roomId] = new Room(matrixRoom, roomType, stateEvents);
				if (roomName) {
					this.rooms[matrixRoom.roomId].name = roomName;
				}
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

		deleteRoomsWithMatrixRoom(roomId: string) {
			if (this.currentRoomId === roomId) {
				this.currentRoomId = '';
			}
			delete this.rooms[roomId];
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
			const pubhubs = usePubhubsStore();
			const rooms = await pubhubs.getAllPublicRooms();
			this.publicRooms = rooms.sort(propCompare('name'));
		},

		// Filter rooms based on type defined. Synapse public rooms doesn't have a type so they are undefined.
		// Useful to filter based on custom room types.
		fetchRoomArrayByType(type: string | undefined): Array<Room> {
			const user = useUser();
			const rooms = [...this.roomsArray].sort((a, b) => a.name.localeCompare(b.name));
			// visibility is based on a prefix on room names when the room is joined or left.
			if (type === RoomType.PH_MESSAGES_DM) {
				return rooms.filter((room) => room.getType() === type).filter((room) => isVisiblePrivateRoom(room.name, user.user));
			}
			return rooms.filter((room) => room.getType() === type);
		},

		// Filter rooms based on accessibility: Public, Secured or Directmessages
		fetchRoomArrayByAccessibility(types: RoomType[]): Array<Room> {
			const user = useUser();
			const rooms = [...this.roomsArray].sort((a, b) => a.name.localeCompare(b.name));
			// filter all the rooms by type
			// filter OUT every room that is a PH_MESSAGES_DM where !isVisiblePrivateRoom
			let result = rooms.filter((room) => room.getType() !== undefined && types.includes(room.getType() as RoomType));
			if (types.includes(RoomType.PH_MESSAGES_DM)) {
				result = result.filter((room) => room.getType() !== undefined && (room.getType() !== RoomType.PH_MESSAGES_DM || isVisiblePrivateRoom(room.name, user.user!)));
			}
			return result;

			// TODO sliding sync
			// This was commented out for the private rooms to show anything at all
			// visibility is based on a prefix on room names when the room is joined or left.
			// if (types.includes(RoomType.PH_MESSAGES_DM)) {
			// 	return rooms.filter((room) => room.getType() !== undefined && types.includes(room.getType() as RoomType)).filter((room) => isVisiblePrivateRoom(room.name, user));
			// }
			return rooms.filter((room) => room.getType() !== undefined && types.includes(room.getType() as RoomType));
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
			const encodedObject = encodeURIComponent(
				JSON.stringify({
					types: [EventType.RoomMessage],
					senders: [hub_notice],
					limit: limit,
				}),
			);
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
		async getSecuredRoomInfo(roomId: string): Promise<TSecuredRoom | undefined> {
			// Check if already in the store
			const existing = this.securedRooms.find((room) => room.room_id === roomId);
			if (existing) {
				this.securedRoom = existing;
				return existing;
			}

			// Otherwise, fetch from API
			const jsonInString = await api_synapse.apiGET<string>(api_synapse.apiURLS.securedRoom + '?room_id=' + roomId);
			const fetchedRoom = JSON.parse(jsonInString) as TSecuredRoom;

			this.securedRooms.push(fetchedRoom);

			this.securedRoom = fetchedRoom;
			return fetchedRoom;
		},

		async addSecuredRoom(room: TSecuredRoom) {
			if (!validSecuredRoomAttributes(room)) {
				throw new Error('errors.no_valid_attribute');
			}
			const newRoom = await api_synapse.apiPOST<TSecuredRoom>(api_synapse.apiURLS.securedRooms, room);
			this.securedRooms.push(newRoom);
			this.fetchPublicRooms(); // Reset PublicRooms, so the new room is indeed recognised as a secured room. TODO: could this be improved without doing a fetch?
			const pubhubs = usePubhubsStore();
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
			const body = { block: true, purge: true };

			const response = await api_synapse.apiDELETE(api_synapse.apiURLS.roomsAPIV2 + room_id, body);
			// @ts-expect-error
			const deleted_id = response.delete_id;

			this.room(room_id)?.setHidden(true);

			this.publicRooms = this.publicRooms.filter((r: any) => r.room_id !== room_id);

			return deleted_id;
		},

		async removeSecuredRoom(room: TSecuredRoom) {
			const response = await api_synapse.apiDELETE(api_synapse.apiURLS.securedRooms + '?room_id=' + room.room_id);
			// @ts-expect-error
			const deleted_id = response.deleted;

			// replace securedRooms and publicRooms with new arrays
			this.securedRooms = this.securedRooms.filter((r) => r.room_id !== deleted_id);
			this.publicRooms = this.publicRooms.filter((r: any) => r.room_id !== deleted_id);

			this.room(deleted_id)?.setHidden(true);
			return deleted_id;
		},

		async loadYiviModules() {
			import('@hub-client/assets/yivi.min.css');

			const [coreModule, webModule, clientModule] = await Promise.all([import('@privacybydesign/yivi-core'), import('@privacybydesign/yivi-web'), import('@privacybydesign/yivi-client')]);
			return {
				yiviCore: coreModule.default,
				yiviWeb: webModule.default,
				yiviClient: clientModule.default,
			};
		},

		async loadYiviFrontend() {
			const yivi = await import('@privacybydesign/yivi-frontend');
			return yivi;
		},

		yiviSecuredRoomflowInternal(roomId: string, onFinish: (result: SecuredRoomAttributeResult) => unknown, yiviCore: any, yiviWeb: any, yiviClient: any) {
			const pubhubs = usePubhubsStore();
			const settings = useSettings();

			const accessToken = pubhubs.Auth.getAccessToken();
			if (!accessToken) throw new Error('Access token missing.');

			// @ts-ignore
			const urlll = CONFIG._env.HUB_URL + '/_synapse/client/ph';
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

		yiviSecuredRoomflow(roomId: string, onFinish: (result: SecuredRoomAttributeResult) => unknown) {
			this.loadYiviModules().then(({ yiviCore, yiviWeb, yiviClient }) => {
				this.yiviSecuredRoomflowInternal(roomId, onFinish, yiviCore, yiviWeb, yiviClient);
			});
		},

		yiviSignMessageInternal(message: string, attributes: string[], roomId: string, threadRoot: TMessageEvent | undefined, onFinish: (result: YiviSigningSessionResult, threadRoot: TMessageEvent | undefined) => unknown, yivi: any) {
			const settings = useSettings();
			const pubhubsStore = usePubhubsStore();

			const accessToken = pubhubsStore.Auth.getAccessToken();
			if (!accessToken) throw new Error('Access token missing.');

			// @ts-ignore
			const urlll = CONFIG._env.HUB_URL + '/_synapse/client/ph';
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
					onFinish(result, threadRoot);
				})
				.catch((error: any) => {
					console.info(`There is an Error: ${error}`);
				});
		},

		yiviSignMessage(message: string, attributes: string[], roomId: string, threadRoot: TMessageEvent | undefined, onFinish: (result: YiviSigningSessionResult, threadRoot: TMessageEvent | undefined) => unknown) {
			this.loadYiviFrontend().then((yivi) => {
				this.yiviSignMessageInternal(message, attributes, roomId, threadRoot, onFinish, yivi);
			});
		},

		yiviAskDisclosureInternal(message: string, attributes: string[], roomId: string, onFinish: (result: YiviSigningSessionResult) => unknown, yivi: any) {
			console.log(`yiviAskDisclosure: '${message}', attributes=[${attributes}], ${roomId}`);

			const settings = useSettings();
			const pubhubsStore = usePubhubsStore();

			const accessToken = pubhubsStore.Auth.getAccessToken();
			if (!accessToken) throw new Error('Access token missing.');

			// @ts-ignore
			const urlll = CONFIG._env.HUB_URL + '/_synapse/client/ph';
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

		yiviAskDisclosure(message: string, attributes: string[], roomId: string, onFinish: (result: YiviSigningSessionResult) => unknown) {
			this.loadYiviFrontend().then((yivi) => {
				this.yiviAskDisclosureInternal(message, attributes, roomId, onFinish, yivi);
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
				return this.getTPublicRoom(this.currentRoomId)!;
			}
		},
		getTPublicRoom(roomId: string): TPublicRoom | undefined {
			return this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
		},
		getTotalPrivateRoomUnreadMsgCount(): number {
			// const dmRooms = this.fetchRoomArrayByType(RoomType.PH_MESSAGES_DM) ?? [];
			// const groupRooms = this.fetchRoomArrayByType(RoomType.PH_MESSAGES_GROUP) ?? [];
			// const adminRooms = this.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT) ?? [];

			// const totalPrivateRooms = [...dmRooms, ...groupRooms, ...adminRooms];

			const totalPrivateRooms = this.fetchRoomArrayByAccessibility(DirectRooms);
			return totalPrivateRooms.reduce((total, room) => total + (room.getRoomUnreadNotificationCount(NotificationCountType.Total) ?? 0), 0);
		},
		async kickUsersFromSecuredRoom(roomId: string): Promise<void> {
			try {
				await api_synapse.apiPOST(`${api_synapse.apiURLS.data}?data=removed_from_secured_room`, { room_id: roomId });
			} catch (error) {
				console.error(`Could not kick all users from ${roomId}`, error);
			}
		},
		// Steward room logic //

		stewardRooms(): Array<Room> {
			const rooms = useRooms();
			return rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_STEWARD_CONTACT);
		},

		currentStewardRoom(roomId: string): Room | undefined {
			return this.stewardRooms().filter((room) => room.name.split(',')[0] === roomId)[0];
		},

		/**
		 * Creates a steward room or modifies the existing one.
		 * If the room already exists, it updates the members.
		 * If it doesn't exist, it creates a new private room with the given members.
		 * @param roomId - The ID of the room to create or modify.
		 * @param members - An array of RoomMember objects representing the members of the room.
		 */
		async createStewardRoomOrModify(roomId: string, members: Array<RoomMember>): Promise<void> {
			const user = useUser();
			const pubhubs = usePubhubsStore();
			const stewardIds = members.map((member) => member.userId);

			const stewardRoom: Room = this.currentStewardRoom(roomId);

			if (stewardRoom) {
				const roomMembers: TRoomMember[] = stewardRoom.matrixRoom.getMembers();
				// If moderators are updated then update the moderators join and leave in the room.

				roomMembers.forEach(async (member: TRoomMember) => {
					if (this.room(roomId).getPowerLevel(member.userId) !== 50 && member.userId !== user.userId) {
						if (stewardRoom.getMember(member.userId)?.membership !== 'leave') {
							await pubhubs.client.kick(stewardRoom.roomId, member.userId);
						}
					}
					const roomUserId = roomMembers.map((member) => member.userId);

					const newStewardId = stewardIds.filter((stewardUserId) => !roomUserId.includes(stewardUserId));
					if (newStewardId.length > 0) {
						newStewardId.forEach(async (thisSteward) => {
							await pubhubs.invite(stewardRoom.roomId, thisSteward);
						});
					}
				});
				await pubhubs.routeToRoomPage({ room_id: stewardRoom.roomId });
			} else {
				const pubhubs = usePubhubsStore();

				const privateRoom = await pubhubs.createPrivateRoomWith(members, false, true, roomId);
				privateRoom && (await pubhubs.routeToRoomPage(privateRoom));
			}
		},
	},
});

export { type TEvent } from '@hub-client/models/events/TEvent';
export { type TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
export { type TRoomMember } from '@hub-client/models/rooms/TRoomMember';
export { type SecuredRoomAttributes, type TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';
export { type TUser } from '@hub-client/models/users/TUser';
export { Room, useRooms };
