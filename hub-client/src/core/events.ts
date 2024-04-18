import { SyncState } from 'matrix-js-sdk/lib/sync';
import { MatrixClient, MatrixEvent, ClientEvent, Room as MatrixRoom, RoomEvent, RoomMemberEvent, RoomMember } from 'matrix-js-sdk';

import { useSettings, User, useConnection, useUser, useRooms, Room } from '@/store/store';
import { usePubHubs } from '@/core/pubhubsStore';

class Events {
	private readonly client: MatrixClient;

	public constructor(client: MatrixClient) {
		this.client = client;
		this.client.on(RoomEvent.Name, this.eventRoomName);
		this.client.on(RoomEvent.Timeline, this.eventRoomTimeline);
		this.client.on(RoomMemberEvent.Name, this.eventRoomMemberName);
		this.client.on(RoomMemberEvent.Membership, this.eventRoomMemberMembership(this.client));
	}

	initEvents() {
		return new Promise((resolve) => {
			this.client.on(ClientEvent.Sync, (state: SyncState) => {
				// console.debug('STATE:', state);

				const connection = useConnection();
				if (state == 'ERROR') {
					connection.error();
				}
				if (state == 'RECONNECTING') {
					connection.off();
				}
				if (state == 'SYNCING') {
					connection.on();
				}
				if (state == 'PREPARED') {
					// DEBUGGING purpose - To understand the following events.
					// this.client.on('event' as any, (event: any) => {
					// 	console.debug('== EVENT', event.getType());
					// 	console.debug('== EVENT', event);
					// });
					resolve(true);
				}
			});

			// Start client sync
			const settings = useSettings();
			this.client.startClient({
				initialSyncLimit: settings.pagination,
				includeArchivedRooms: false,
			});
		});
	}

	/**
	 * Matrix Events
	 */

	eventRoomName(matrixRoom: MatrixRoom) {
		const rooms = useRooms();
		// console.debug('Room.name', room.name);
		rooms.addRoom(new Room(matrixRoom));
	}

	eventRoomTimeline(event: MatrixEvent, matrixRoom: MatrixRoom | undefined, toStartOfTimeline: boolean | undefined) {
		// console.debug('Room.timeline', toStartOfTimeline, removed);
		if (!matrixRoom) return;
		const rooms = useRooms();
		const phRoom = rooms.addRoom(new Room(matrixRoom));

		if (!toStartOfTimeline) {
			if (event.event.type != 'm.room.message') return;

			if (phRoom.roomId !== rooms.currentRoomId) {
				phRoom.unreadMessageCounter(event);
			}
			rooms.onModRoomMessage(event);
		}
	}

	eventRoomMemberName(event: MatrixEvent, member: RoomMember) {
		const user = useUser();
		// console.debug('RoomMember.name', member.user);
		if (member.user !== undefined && member.user.userId == user.user.userId) {
			user.setUser(member.user as User);
			if (member.user.displayName !== undefined) {
				user.user.setDisplayName(member.user.displayName);
			}
		}
	}

	eventRoomMemberMembership(client: MatrixClient) {
		return function eventRoomMemberMembershipInner(event: MatrixEvent, member: RoomMember) {
			const me = client.getUserId();
			// console.debug('RoomMember.membership', member.membership, member.userId, me, event.getRoomId());
			if (me == member.userId) {
				const rooms = useRooms();
				if (member.membership == 'leave') {
					const roomId = event.getRoomId();
					if (roomId != undefined) {
						rooms.rooms[roomId].setHidden(true);
					}
				} else if (member.membership == 'invite') {
					const pubhubs = usePubHubs();
					pubhubs
						.joinRoom(member.roomId)
						.catch((e) => console.debug(e.toString()))
						//This sometimes gives an error when the room cannot be found, maybe it's an old experiment or
						// deleted. Reflects the state, so we just show some debug info.
						.then(function () {
							console.log('joined DM');
						});
				}
			}
		};
	}
}

export { Events };
