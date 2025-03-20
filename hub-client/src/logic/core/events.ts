import { EventTimeLineHandler } from '@/logic/core/eventTimeLineHandler';
import { usePubHubs } from '@/logic/core/pubhubsStore';
import { TEvent } from '@/model/events/TEvent';
import { ClientEvent, EventType, MatrixClient, MatrixEvent, Room as MatrixRoom, MsgType, RoomEvent, RoomMember, RoomMemberEvent } from 'matrix-js-sdk';
import { useConnection } from '@/logic/store/connection';
import { useSettings } from '@/logic/store/settings';
import { useRooms } from '@/logic/store/store';
import { SyncState } from 'matrix-js-sdk/lib/sync';

enum RedactReasons {
	Deleted = 'Deleted',
	DeletedFromThread = 'Deleted from thread',
}

enum PubHubsMgType {
	SignedMessage = 'pubhubs.signed_message',
	AskDisclosureMessage = 'pubhubs.ask_disclosure_message',
}

class Events {
	private readonly client: MatrixClient;
	private readonly eventTimeHandler = new EventTimeLineHandler();

	public constructor(client: MatrixClient) {
		this.client = client;
		this.client.on(RoomEvent.Timeline, (event: MatrixEvent, matrixRoom: MatrixRoom | undefined, toStartOfTimeline: boolean | undefined) => this.eventRoomTimeline(this.eventTimeHandler, event, matrixRoom, toStartOfTimeline));
		this.client.on(RoomMemberEvent.Membership, this.eventRoomMemberMembership(this.client));
	}

	initEvents() {
		return new Promise((resolve) => {
			this.client.on(ClientEvent.Sync, (state: SyncState) => {
				// console.debug('STATE:', state);

				const connection = useConnection();
				if (state === 'ERROR') {
					connection.error();
				}
				if (state === 'RECONNECTING') {
					connection.off();
				}
				if (state === 'SYNCING') {
					connection.on();
				}
				if (state === 'PREPARED') {
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
				threadSupport: true,
				initialSyncLimit: settings.pagination,
				includeArchivedRooms: false,
			});
		});
	}

	/**
	 * Matrix Events
	 */

	eventRoomTimeline(eventTimeLineHandler: EventTimeLineHandler, event: MatrixEvent, matrixRoom: MatrixRoom | undefined, toStartOfTimeline: boolean | undefined) {
		if (!matrixRoom) return;

		if (event.event.type === EventType.RoomMessage && event.event.content?.msgtype === MsgType.Text) {
			event.event = eventTimeLineHandler.transformEventContent(event.event as Partial<TEvent>);
		}

		if (event.event.type === EventType.RoomMessage && event.event.content?.msgtype === MsgType.Notice) {
			const rooms = useRooms();
			//Messages are only in rooms.
			rooms.addProfileNotice(event.getRoomId()!, event.getContent().body);
		}

		if (!toStartOfTimeline) {
			if (event.event.type !== EventType.RoomMessage) return;
			const rooms = useRooms();
			rooms.onModRoomMessage(event);
		}
	}

	eventRoomMemberMembership(client: MatrixClient) {
		return function eventRoomMemberMembershipInner(event: MatrixEvent, member: RoomMember) {
			const me = client.getUserId();
			// console.debug('RoomMember.membership', member.membership, member.userId, me, event.getRoomId());
			if (me === member.userId) {
				const rooms = useRooms();
				if (member.membership === 'leave') {
					const roomId = event.getRoomId();
					if (roomId !== undefined && rooms.rooms[roomId]) {
						rooms.rooms[roomId].setHidden(true);
					}
				} else if (member.membership === 'invite') {
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

export { Events, RedactReasons, PubHubsMgType };
