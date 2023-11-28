import { SyncState } from 'matrix-js-sdk/lib/sync';
import { MatrixClient, MatrixEvent, ClientEvent, Room as MatrixRoom, RoomEvent, RoomMemberEvent, RoomMember } from 'matrix-js-sdk';

import { useSettings, User, useConnection, useUser, useRooms } from '@/store/store';
import { usePubHubs } from '@/core/pubhubsStore';

class Events {
	private client: MatrixClient;

	public constructor(client: MatrixClient) {
		this.client = client;
	}

	initEvents() {
		return new Promise((resolve) => {
			const self = this;
			this.client.on(ClientEvent.Sync, (state: SyncState) => {
				console.debug('STATE:', state);

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
				console.debug('STATE:', state);
				if (state == 'PREPARED') {
				
					// this.client.on('event' as any, (event: any) => {
					// 	console.debug('== EVENT', event);
					// });
					this.client.on(RoomEvent.Name, self.eventRoomName);
					this.client.on(RoomEvent.Timeline, self.eventRoomTimeline);
					this.client.on(RoomMemberEvent.Name, self.eventRoomMemberName);
					this.client.on(RoomMemberEvent.Membership, self.eventRoomMemberMembership(this.client));
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

	eventRoomName(room: MatrixRoom) {
		const rooms = useRooms();
		console.debug('Room.name', room.name);
		rooms.addMatrixRoom(room);
	}

	eventRoomTimeline(event: MatrixEvent, room: MatrixRoom | undefined, toStartOfTimeline: boolean | undefined, removed: boolean) {
		const rooms = useRooms();
		console.debug('Room.timeline', toStartOfTimeline, removed);
		if (room != undefined) {
			if (toStartOfTimeline) {
				rooms.addMatrixRoom(room);
			} else {
				rooms.addMatrixRoom(room);
				if (event.event.type == 'm.room.message' && room.roomId !== rooms.currentRoomId) {
					rooms.addRoomUnreadMessages(room.roomId);
				}
			}
		}
	}

	eventRoomMemberName(event: MatrixEvent, member: RoomMember) {
		const user = useUser();
		console.debug('RoomMember.name', member.user);
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
			console.debug('RoomMember.membership', member.membership, member.userId, me, event.getRoomId());
			if (me == member.userId) {
				const rooms = useRooms();
				if (member.membership == 'leave') {
					const roomId = event.getRoomId();
					if (roomId != undefined) {
						rooms.rooms[roomId].hidden = true;
					}
				} else if (member.membership == 'invite') {
					const pubhubs = usePubHubs();
					pubhubs.joinRoom(member.roomId).then(function () {
						console.log('joined DM');
					});
				}
			}
		};
	}
}

export { Events };
