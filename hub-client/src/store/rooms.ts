import { defineStore } from 'pinia';
import { Room as MatrixRoom, MatrixEvent, NotificationCountType } from 'matrix-js-sdk';
import { Message, MessageType, useMessageBox } from './messagebox';
import { useRouter } from 'vue-router';
import { api_synapse, api_matrix } from '@/core/api';
import { usePubHubs } from '@/core/pubhubsStore';
import { propCompare } from '@/core/extensions';
import { YiviSigningSessionResult, AskDisclosure, AskDisclosureMessage } from '@/lib/signedMessages';
import { useUser } from './user';
import Room from '@/model/rooms/Room';
import { TPublicRoom } from '@/model/rooms/TPublicRoom';
import { TSecuredRoom } from '@/model/rooms/TSecuredRoom';
import { RoomType } from '@/model/rooms/TBaseRoom';

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

const useRooms = defineStore('rooms', {
	state: () => {
		return {
			currentRoomId: '' as string,
			roomsLoaded: false as boolean,
			rooms: {} as { [index: string]: Room },
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
				if (this.roomExists(room.room_id) && !this.room(room.room_id)?.isHidden()) {
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
			if (e.event?.type === 'm.room.message' && e.event.content?.msgtype === 'pubhubs.ask_disclosure_message') {
				const user = useUser();
				const ask = e.event.content.ask_disclosure_message as AskDisclosureMessage;
				if (ask.userId === user.user.userId) {
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

		updateRoomsWithMatrixRooms(rooms: MatrixRoom[]) {
			this.roomsLoaded = true;
			const tempRooms = {} as { [index: string]: Room }; // reset rooms
			rooms
				.filter((room) => room.getMyMembership() === 'join')
				.forEach((matrixRoom) => {
					//@ts-ignore
					tempRooms[matrixRoom.roomId] = new Room(matrixRoom);
				});
			this.rooms = tempRooms;
		},

		/**
		 * Wraps the matrixRoom with our own Room class and adds it to the store.
		 *
		 * @returns the added room
		 */
		addRoom(room: Room): Room {
			if (!this.roomExists(room.roomId)) {
				this.rooms[room.roomId] = room;
				this.roomsLoaded = true;
			}
			return this.rooms[room.roomId];
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

		roomIsSecure(roomId: string): boolean {
			const publicRoom = this.publicRooms.find((room: TPublicRoom) => room.room_id === roomId);
			return publicRoom?.room_type === RoomType.PH_MESSAGES_RESTRICTED;
		},

		//? Some documentation would be helpful here.
		async storeRoomNotice(roomId: string) {
			try {
				const hub_notice = await api_synapse.apiGET<string>(api_synapse.apiURLS.notice);
				const creatingAdminUser = this.currentRoom?.getCreator();
				if (!this.roomNotices[roomId]) {
					this.roomNotices[roomId] = {};
				}

				if (creatingAdminUser) {
					this.roomNotices[roomId][creatingAdminUser!] = ['rooms.admin_badge'];
				}
				const encodedObject = encodeURIComponent(JSON.stringify({ types: ['m.room.message'], senders: [hub_notice], limit: 100000 }));
				const response = await api_matrix.apiGET<RoomMessages>(api_matrix.apiURLS.rooms + roomId + '/messages?filter=' + encodedObject);
				for (const message of response.chunk) {
					const body = message.content.body;
					this.addProfileNotice(roomId, body);
				}
			} catch (error) {
				console.log(error);
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
			const newRoom = await api_synapse.apiPOST<TSecuredRoom>(api_synapse.apiURLS.securedRooms, room);
			this.securedRooms.push(newRoom);
			this.fetchPublicRooms(); // Reset PublicRooms, so the new room is indeed recognised as a secured room. TODO: could this be improved without doing a fetch?
			return newRoom;
		},

		async changeSecuredRoom(room: TSecuredRoom) {
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
			const response = await api_synapse.apiDELETE<any>(api_synapse.apiURLS.deleteRoom + room_id, body);

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
								pubhubs.updateRooms().then(() => router.push({ name: 'room', params: { id: roomId } }));
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

export { useRooms, RoomType, Room };
export { type TEvent } from '@/model/events/TEvent';
export { type TPublicRoom } from '@/model/rooms/TPublicRoom';
export { type SecuredRoomAttributes, type TSecuredRoom } from '@/model/rooms/TSecuredRoom';
export { type TUser } from '@/model/users/TUser';
export { type TRoomMember } from '@/model/rooms/TRoomMember';
