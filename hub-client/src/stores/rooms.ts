// Packages
import { EventType, IStateEvent, Room as MatrixRoom, NotificationCountType, RoomMember } from 'matrix-js-sdk';
import { MSC3575RoomData as SlidingSyncRoomData } from 'matrix-js-sdk/lib/sliding-sync';
import { defineStore } from 'pinia';

// Logic
import { api_matrix, api_synapse } from '@hub-client/logic/core/api';
import { propCompare } from '@hub-client/logic/core/extensions';
import { isVisiblePrivateRoom } from '@hub-client/logic/core/privateRoomNames';

// Models
import { ScrollPosition } from '@hub-client/models/constants';
import Room from '@hub-client/models/rooms/Room';
import { DirectRooms, RoomListRoom, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';
import { TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useUser } from '@hub-client/stores/user';

// Types
type RoomMessages = {
	chunk: Chunk[];
	start: string;
	end: string;
};

type Chunk = {
	type: string;
	room_id: string;
	sender: string;
	content: Content;
	origin_server_ts: number;
	unsigned: Unsigned;
	event_id: string;
	user_id: string;
	age: number;
};

type Content = {
	body: string;
	msgtype: string;
};

type Unsigned = {
	age: number;
};

function validSecuredRoomAttributes(room: TSecuredRoom): boolean {
	// Note that it is allowed to have no attribute values for an attribute type.
	// So that that the attribute is required but all values are allowed.
	if (!room.accepted) {
		return false;
	}

	const hasEmptyAttributeType = Object.keys(room.accepted).includes('');
	if (hasEmptyAttributeType) return false;

	return true;
}

const useRooms = defineStore('rooms', {
	state: () => {
		return {
			currentRoomId: '' as string,
			rooms: {} as { [index: string]: Room },
			roomList: [] as Array<RoomListRoom>, // Sorted list of rooms for menu
			publicRooms: [] as Array<TPublicRoom>,
			securedRooms: [] as Array<TSecuredRoom>,
			roomNotices: {} as { [room_id: string]: { [user_id: string]: string[] } },
			securedRoom: {} as TSecuredRoom,
			initialRoomsLoaded: false,
			timestamps: [] as Array<Array<number | string>>,
			scrollPositions: {} as { [room_id: string]: string },
			unreadCountVersion: 0, // Increment to trigger reactive updates for badge
		};
	},

	// #region getters
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
			const rooms = values.filter((room) => room.roomId !== undefined && room.roomId !== room.name);
			return rooms;
		},

		/**
		 * Filter room displaylist based on RoomTypes
		 * @param types Array of RoomTypes to fetch
		 */
		filteredRoomList() {
			return (types: RoomType[]) => {
				const user = useUser();
				return this.roomList
					.filter((room) => room.isHidden === false && room.roomType && types.includes(room.roomType as RoomType))
					.filter((room) => {
						if (!types.includes(RoomType.PH_MESSAGES_DM)) return true;
						return room.roomType !== RoomType.PH_MESSAGES_DM || isVisiblePrivateRoom(room.name, user.user!);
					});
			};
		},

		// TODO never used. Can be deleted?
		// sortedRoomsArrayByJoinedTime(): Array<Room> {
		// 	const user = useUser();
		// 	const rooms: Array<Room> = Object.assign([], this.roomsArray);
		// 	rooms.sort((a, b) => {
		// 		const aJoined = a.getMember(user.userId!)?.getLastModifiedTime();
		// 		const bJoined = b.getMember(user.userId!)?.getLastModifiedTime();
		// 		return aJoined! < bJoined! ? 1 : -1;
		// 	});
		// 	return rooms;
		// },
		// sortedRoomsArray(): Array<Room> {
		// 	const rooms: Array<Room> = Object.assign([], this.roomsArray);
		// 	rooms.sort((a, b) => (a.name > b.name ? 1 : -1));
		// 	return rooms;
		// },
		// privateRooms(): Array<Room> {
		// 	const rooms: Array<Room> = Object.assign([], this.roomsArray);
		// 	const privateRooms = rooms.filter((item) => item.getType() == RoomType.PH_MESSAGES_DM);
		// 	return privateRooms;
		// },

		hasRooms(): boolean {
			return this.roomsArray?.length > 0;
		},

		roomExists: (state) => {
			return (roomId: string) => {
				if (roomId) {
					return state.rooms[roomId] !== undefined;
				}
				return false;
			};
		},

		room: (state) => {
			return (roomId: string): Room | undefined => {
				if (state.rooms[roomId] !== undefined) {
					return state.rooms[roomId];
				}
				return undefined;
			};
		},

		getRoomTopic: (state) => {
			return (roomId: string) => {
				if (state.rooms[roomId] === undefined) return '';
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
				return room.room_type === undefined || room.room_type !== RoomType.PH_MESSAGES_RESTRICTED;
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

		// TODO sort securedRooms on adding, so sorting takes place only once
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
		roomtimestamps(state): Array<Array<number | string>> {
			return state.timestamps;
		},
	},

	//#endregion getters

	actions: {
		async waitForInitialRoomsLoaded(): Promise<void> {
			while (!this.initialRoomsLoaded) {
				await new Promise((resolve) => setTimeout(resolve, 50)); // poll every 50 ms
			}
		},

		setRoomsLoaded(value: boolean) {
			this.initialRoomsLoaded = value;
		},
		setTimestamps(timestamps: Array<Array<number | string>>) {
			this.timestamps = timestamps;
		},

		notifyUnreadCountChanged() {
			this.unreadCountVersion++;
		},

		loadFromSlidingSync(roomId: string, roomData: SlidingSyncRoomData) {
			if (this.rooms[roomId]) {
				this.rooms[roomId].loadFromSlidingSync(roomData);
			}
		},

		fetchRoomById(roomId: string): Room | undefined {
			return this.room(roomId);
		},

		changeRoom(roomId: string, skipNavigation = false) {
			if (this.currentRoomId !== roomId) {
				this.currentRoomId = roomId;
				if (!skipNavigation) {
					const messagebox = useMessageBox();
					messagebox.sendMessage(new Message(MessageType.RoomChange, roomId));
				}
			}
		},

		/**
		 * In case the room is not joined yet: join a room from the roomList in the menu. Joins and initializes the timeline
		 * @param roomId
		 */
		async joinRoomListRoom(roomId: string) {
			if (this.rooms[roomId]) {
				return; // Already joined
			}

			const pubhubs = usePubhubsStore();
			await pubhubs.joinRoom(roomId);

			const room = this.room(roomId);
			if (room) {
				room.setStateEvents(this.roomList.find((x) => x.roomId === roomId)?.stateEvents);
			}

			const lastMessageId = this.roomList.find((x) => x.roomId === roomId)?.lastMessageId;
			if (lastMessageId && room) {
				await room.loadToEvent({
					eventId: lastMessageId,
					position: ScrollPosition.Start,
				});
			}
		},

		/**
		 * Updates the roomList with a new room and keeps it sorted on name
		 * @param roomId
		 * @param name
		 * @param type
		 */
		updateRoomList(roomListRoom: RoomListRoom) {
			if (!this.roomList.some((room) => room.roomId === roomListRoom.roomId)) {
				this.roomList.push(roomListRoom);
			}
			this.roomList.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
		},

		setRoomListHidden(roomId: string, isHidden: boolean) {
			const room = this.roomList.find((room) => room.roomId === roomId);
			if (room) {
				room.isHidden = isHidden;
			}
		},

		setRoomListName(roomId: string, name: string) {
			const room = this.roomList.find((room) => room.roomId === roomId);
			if (room) {
				room.name = name;
			}
			// Also update the Room object if it exists
			if (this.rooms[roomId]) {
				this.rooms[roomId].name = name;
			}
			// Re-sort the list since name changed
			this.roomList.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
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
			this.roomList = this.roomList.filter((room) => room.roomId !== roomId);
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

		async fetchPublicRooms(force: boolean = false) {
			const pubhubs = usePubhubsStore();
			const rooms = await pubhubs.getAllPublicRooms(force);
			// TODO its best to sort the publicrooms on adding, then sorting will take place only once
			this.publicRooms = rooms.toSorted(propCompare('name'));
		},

		// Filter rooms based on type defined. Synapse public rooms doesn't have a type so they are undefined.
		// Useful to filter based on custom room types.
		fetchRoomArrayByType(type: string | undefined): Array<Room> {
			const user = useUser();
			// TODO sorting should be done during adding of room so the roomsArray always is sorted!
			const rooms = [...this.roomsArray].sort((a, b) => a.name.localeCompare(b.name));
			// visibility is based on a prefix on room names when the room is joined or left.
			if (type === RoomType.PH_MESSAGES_DM) {
				return rooms.filter((room) => room.getType() === type).filter((room) => isVisiblePrivateRoom(room.name, user.user));
			}
			return rooms.filter((room) => room.getType() === type);
		},

		/**
		 * Filter rooms based on accessibility: Public, Secured or Directmessages
		 * @param types Array of RoomTypes to fetch
		 * @returns
		 */
		fetchRoomArrayByAccessibility(types: RoomType[]): Array<Room> {
			const user = useUser();
			// TODO sorting should be done during adding of room so the roomsArray always is sorted!
			const rooms = [...this.roomsArray].sort((a, b) => a.name.localeCompare(b.name));
			// filter all the rooms by type
			// filter OUT every room that is a PH_MESSAGES_DM where !isVisiblePrivateRoom
			let result = rooms.filter((room) => !room.isHidden() && room.getType() !== undefined && types.includes(room.getType() as RoomType));
			if (types.includes(RoomType.PH_MESSAGES_DM)) {
				result = result.filter((room) => room.getType() !== undefined && (room.getType() !== RoomType.PH_MESSAGES_DM || isVisiblePrivateRoom(room.name, user.user!)));
			}
			return result;
		},

		/**
		 * Filter room displaylist based on RoomTypes
		 * @param types Array of RoomTypes to fetch
		 */
		fetchRoomList(types: RoomType[]): Array<RoomListRoom> {
			const user = useUser();
			let result = this.roomList.filter((room) => room.isHidden === false && room.roomType !== undefined && types.includes(room.roomType as RoomType));
			if (types.includes(RoomType.PH_MESSAGES_DM)) {
				result = result.filter((room) => room.roomType !== undefined && (room.roomType !== RoomType.PH_MESSAGES_DM || (room.name !== undefined && isVisiblePrivateRoom(room.name, user.user!))));
			}
			return result;
		},

		memberOfPublicRoom(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
			if (!publicRoom) return false;
			const foundIndex = this.roomsArray.findIndex((room) => room.roomId === publicRoom?.room_id);
			return foundIndex >= 0;
		},

		publicRoomIsSecure(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
			return publicRoom?.room_type === RoomType.PH_MESSAGES_RESTRICTED;
		},

		roomIsSecure(roomId: string): boolean {
			const room = this.fetchRoomById(roomId);
			return room?.getType() === RoomType.PH_MESSAGES_RESTRICTED;
		},

		//? Some documentation would be helpful here.
		async storeRoomNotice(roomId: string) {
			const hub_notice = await api_synapse.apiGET<string>(api_synapse.apiURLS.notice);
			const creatingAdminUser = this.currentRoom?.getCreator();
			if (!this.roomNotices[roomId]) {
				this.roomNotices[roomId] = {};
			}

			if (creatingAdminUser) {
				this.roomNotices[roomId][creatingAdminUser] = ['rooms.admin_badge'];
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
		// Needs Moderator token
		async fetchSecuredRoomSteward() {
			return await api_synapse.apiGET<TSecuredRoom>(`${api_synapse.apiURLS.securedRooms}?room_id=${this.currentRoom?.roomId}`);
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
			await this.fetchPublicRooms(true); // Force refresh so the new room is recognised as a secured room
			const pubhubs = usePubhubsStore();
			await pubhubs.joinRoom(newRoom.room_id);
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
			// Update roomList with new name
			if (room.name) {
				this.setRoomListName(modified_id, room.name);
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
			this.setRoomListHidden(room_id, true);

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
			this.setRoomListHidden(deleted_id, true);
			return deleted_id;
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
			const pubhubs = usePubhubsStore();
			const totalPrivateRooms = this.filteredRoomList(DirectRooms).map((x) => pubhubs.client.getRoom(x.roomId));
			return totalPrivateRooms.reduce((total, room) => total + (room!.getRoomUnreadNotificationCount(NotificationCountType.Total) ?? 0), 0);
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
			const stewardRoom: Room | undefined = this.currentStewardRoom(roomId);

			if (stewardRoom) {
				const roomMembers: TRoomMember[] = stewardRoom.matrixRoom.getMembers();
				// If moderators are updated then update the moderators join and leave in the room.

				roomMembers.forEach(async (member: TRoomMember) => {
					if (this.room(roomId)?.getPowerLevel(member.userId) !== 50 && member.userId !== user.userId) {
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
