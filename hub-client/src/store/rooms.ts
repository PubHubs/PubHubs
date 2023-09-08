/**
 * This store keeps the rooms of current user
 *
 * with:
 * - definition (Name)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia';
import { Room as MatrixRoom, IPublicRoomsChunkRoom as PublicRoom, MatrixClient, RoomMember } from 'matrix-js-sdk';
import { Message, MessageType, useMessageBox } from './messagebox';
import { useRouter } from 'vue-router';
import { api } from '@/core/api';
import { usePubHubs } from '@/core/pubhubsStore';
import { propCompare } from '@/core/extensions';
import filters from '@/core/filters';

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
	room_name: string;
	accepted?: SecuredRoomAttributes | [];
	user_txt: string;
	type?: string;
	// secured?: boolean;
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
}

class Room extends MatrixRoom {
	_ph: PubHubsRoomProperties;

	constructor(public readonly roomId: string, public readonly client: MatrixClient, public readonly myUserId: string) {
		super(roomId, client, myUserId);
		this._ph = {
			hidden: false,
			unreadMessages: 0,
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

	resetUnreadMessages() {
		this.unreadMessages = 0;
	}

	addUnreadMessages(add: number = 1) {
		this.unreadMessages += add;
	}

	isPrivateRoom(): boolean {
		return this.getType() == PubHubsRoomType.PH_MESSAGES_DM;
	}

	getPrivateRoomNameMembers(): Array<RoomMember> {
		const me = this.client.getUserId();
		const members = this.getMembers();
		const foundMe = members.findIndex((item) => item.userId == me);
		if (foundMe >= 0) {
			members.splice(foundMe, 1);
		}
		return members;
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
}

const useRooms = defineStore('rooms', {
	state: () => {
		return {
			currentRoomId: '' as string,
			rooms: {} as { [index: string]: Room },
			publicRooms: [] as Array<PublicRoom>,
			securedRooms: [] as Array<SecuredRoom>,
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
				return typeof state.rooms[roomId] == 'undefined' ? false : true;
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

		currentRoom(state): Room | undefined {
			if (state.rooms[state.currentRoomId]) {
				return state.rooms[state.currentRoomId];
			}
			return undefined;
		},

		currentRoomHasEvents(state): Boolean {
			const currentRoom = this.currentRoom;
			if (currentRoom) {
				return state.rooms[state.currentRoomId].timeline.length > 0;
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
		changeRoom(roomId: string) {
			if (this.currentRoomId !== roomId) {
				this.currentRoomId = roomId;
				if (roomId != '' && this.rooms[roomId]) {
					this.rooms[roomId].resetUnreadMessages();
					this.sendUnreadMessageCounter();
					const messagebox = useMessageBox();
					messagebox.sendMessage(new Message(MessageType.RoomChange, roomId));
				}
			}
		},

		updateRoomsWithMatrixRooms(rooms: MatrixRoom[]) {
			this.rooms = {} as { [index: string]: Room }; // reset rooms
			for (const idx in rooms) {
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

		addRoomUnreadMessages(roomId: string, unread: number = 1) {
			this.rooms[roomId].addUnreadMessages(unread);
			this.sendUnreadMessageCounter();
		},

		sendUnreadMessageCounter() {
			const messagebox = useMessageBox();
			messagebox.sendMessage(new Message(MessageType.UnreadMessages, this.totalUnreadMessages));
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

		async fetchSecuredRooms() {
			this.securedRooms = await api.apiGET<Array<SecuredRoom>>(api.apiURLS.securedRooms);
		},

		async addSecuredRoom(room: SecuredRoom) {
			const newRoom = await api.apiPOST<SecuredRoom>(api.apiURLS.securedRooms, room);
			this.securedRooms.push(newRoom);
			this.fetchPublicRooms(); // Reset PublicRooms, so the new room is indeed recognised as a secured room. TODO: could this be improved without doing a fetch?
			return newRoom;
		},

		async changeSecuredRoom(room: SecuredRoom) {
			const response = await api.apiPUT<any>(api.apiURLS.securedRooms, room);
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
			const response = await api.apiDELETE<any>(api.apiURLS.deleteRoom + room_id, body);
			const deleted_id = response.delete_id;
			this.room(room_id)?.hide();
			const pidx = this.publicRooms.findIndex((room) => room.room_id == room_id);
			this.publicRooms.splice(pidx, 1);
			return deleted_id;
		},

		async removeSecuredRoom(room: SecuredRoom) {
			const response = await api.apiDELETE<any>(api.apiURLS.securedRooms + '?room_id=' + room.room_id);
			const deleted_id = response.deleted;
			const sidx = this.securedRooms.findIndex((room) => room.room_id == deleted_id);
			this.securedRooms.splice(sidx, 1);
			const pidx = this.publicRooms.findIndex((room) => room.room_id == deleted_id);
			this.publicRooms.splice(pidx, 1);
			this.room(deleted_id)?.hide();
			return deleted_id;
		},

		// This extracts the notice which is used in secured rooms.
		// The notice contains the user id and the profile attribute.
		getBadgeInSecureRoom(roomId: string, cDisplayName: string): string {
			let attribute = '';
			const displayName = filters.extractPseudonym(cDisplayName);
			for (const evt of this.rooms[roomId].timeline) {
				if (evt.getContent().msgtype === 'm.notice') {
					// This notice is specific to secured room, there should be attributes.
					console.info('>>> Event Information for profile attribues  ==>' + evt.getContent().body + 'for display name=' + displayName);
					if (evt.getContent().body.includes('attributes') && evt.getContent().body.includes(displayName)) {
						attribute = filters.extractJSONFromEventString(evt);
						console.info('>>> Attribute value  ==>' + attribute);
						break;
					}
				}
			}
			return attribute;
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
	},
});

export { PubHubsRoomType, Room, PublicRoom, SecuredRoomAttributes, SecuredRoom, useRooms };
