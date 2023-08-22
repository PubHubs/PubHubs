import { SyncState } from 'matrix-js-sdk/lib/sync';
import { MatrixClient, MatrixEvent, ClientEvent, Room as MatrixRoom, RoomEvent, RoomMemberEvent, RoomMember } from 'matrix-js-sdk';

import { useSettings, User, useUser, useRooms } from '@/store/store';

class Events {
	private client!: MatrixClient;
	private joinPH!: Function;

	startWithClient(client: MatrixClient, joinPH: Function) {
		this.client = client;
		this.joinPH = joinPH;
	}

	initEvents() {
		return new Promise((resolve) => {
			const self = this;
			this.client.on(ClientEvent.Sync, (state: SyncState) => {
				if (state == 'PREPARED') {
					// this.client.on("event", (event) => {
					//     console.debug('== EVENT', event.getType());
					// })
					this.client.on(RoomEvent.Name, self.eventRoomName);
					this.client.on(RoomEvent.Timeline, self.eventRoomTimeline);
					this.client.on(RoomMemberEvent.Name, self.eventRoomMemberName);
					this.client.on(RoomMemberEvent.Membership, self.eventRoomMemberMembership(this.client, this.joinPH));

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

	eventRoomMemberMembership(client: MatrixClient, joinPH: Function) {
		return function eventRoomMemberMembershipInner(event: MatrixEvent, member: RoomMember) {
			const rooms = useRooms();
			console.debug('RoomMember.membership', member.membership, event.getRoomId());
			if (member.membership == 'leave') {
				const roomId = event.getRoomId();
				if (roomId != undefined) {
					rooms.rooms[roomId].hidden = true;
				}
			} else if (member.membership == 'invite') {
				const me = client.getUserId();
				if (member.userId == me) {
					joinPH(member.roomId).then(function () {
						console.log('joined DM');
					});
				}
			}
		};
	}
}

export { Events };
