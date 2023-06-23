/**
 * This store keeps the rooms of current user
 *
 * with:
 * - definition (Name)
 * - the store itself (useName)
 *
 */

import { defineStore } from 'pinia';
import { Room as MatrixRoom, MatrixClient } from 'matrix-js-sdk';

import { Message, MessageType, useMessageBox } from './messagebox';
import { useRouter } from 'vue-router';

/**
 *  Extending the MatrixRoom with some extra properties and there methods:
 *
 *      hidden : boolean        - keep track of 'removed' rooms that are not synced yet.
 *      unreadMessages : number - keep track of new messages in a room that are not read by the user.
 */

/*
 *   Secured Room state types.
 *   This is used only for secured room to check the Yivi status
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
}

const useRooms = defineStore('rooms', {
    state: () => {
        return {
            currentRoomId: '' as string,
            rooms: {} as { [index: string]: Room },
            userAttributes: {} as { [userId: string]: string },
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

        currentRoom(state): Room {
            return state.rooms[state.currentRoomId];
        },

        currentRoomHasEvents(state): Boolean {
            return state.rooms[state.currentRoomId].timeline.length > 0;
        },

        currentRoomExists(state): boolean {
            return this.roomExists(state.currentRoomId);
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

        // Sepcific methods for secured rooms.

        roomIsSecure(roomId: string) {
            if (this.rooms[roomId] !== undefined) {
                if (this.rooms[roomId].timeline[0].event.content?.type !== undefined) {
                    return true;
                }
                return false;
            }
            return false;
        },

        yiviSecuredRoomflow(roomId: string, authToken: string) {
            const router = useRouter();

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
                        router.push({ name: 'room', params: { id: roomId } });
                    }
                })
                .catch((error: any) => {
                    console.info(`There is an Error: ${error}`);
                });
        },

        createAttributeRelation(userNotice: string) {
            const [userId] = userNotice.split(':');
            const lastIndex = userNotice.lastIndexOf(':');
            const attribute = userNotice
                .slice(lastIndex + 1)
                .replace(/[{}']/g, '')
                .trim();
            this.userAttributes[userId] = attribute;
        },
        currentUserAttribute(userId: string) {
            const currentUserId = '@' + userId;
            for (const key in this.userAttributes) {
                const value = this.userAttributes[key];
                console.info(`Map content${key}, ${value}`);
            }
            return this.userAttributes[currentUserId];
        },
    },
});

export { Room, useRooms };
