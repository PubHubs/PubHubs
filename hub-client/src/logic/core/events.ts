// Packages
import { EventType, MatrixClient, MatrixEvent, MsgType, RoomMember } from 'matrix-js-sdk';

// Logic
import { EventTimeLineHandler } from '@hub-client/logic/core/eventTimeLineHandler';

// Models
import { TEvent } from '@hub-client/models/events/TEvent';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

enum PubHubsMsgType {
	Default = '',
	SignedMessage = 'pubhubs.signed_message',
	AskDisclosureMessage = 'pubhubs.ask_disclosure_message',
	DisclosedMessage = 'pubhubs.disclosed_message',
	AnnouncementMessage = 'pubhubs.announcement_message',
	VotingWidget = 'pubhubs.voting_widget.widget',
	VotingWidgetEdit = 'pubhubs.voting_widget.edit',
	VotingWidgetVote = 'pubhubs.voting_widget.vote',
	VotingWidgetClose = 'pubhubs.voting_widget.close',
	VotingWidgetOpen = 'pubhubs.voting_widget.open',
	VotingWidgetPickOption = 'pubhubs.voting_widget.pick_option',
	VotingWidgetAddVoteOption = 'pubhubs.voting_widget.add_vote_option',
	VotingWidgetReply = 'pubhubs.voting_widget.reply',
	VotingWidgetModify = 'pubhubs.voting_widget.modify',
	SignedFileMessage = 'pubhubs.roomlibrary.signed_file',
	LibraryFileMessage = 'pubhubs.roomlibrary.file',
}

enum PubHubsInvisibleMsgType {
	VotingWidgetEdit = 'pubhubs.voting_widget.edit',
	VotingWidgetVote = 'pubhubs.voting_widget.vote',
	VotingWidgetClose = 'pubhubs.voting_widget.close',
	VotingWidgetOpen = 'pubhubs.voting_widget.open',
	VotingWidgetPickOption = 'pubhubs.voting_widget.pick_option',
	VotingWidgetAddVoteOption = 'pubhubs.voting_widget.add_vote_option',
	VotingWidgetReply = 'pubhubs.voting_widget.reply',
	VotingWidgetModify = 'pubhubs.voting_widget.modify',
}

class Events {
	//private readonly client: MatrixClient;
	private readonly eventTimeLineHandler = new EventTimeLineHandler();

	/**
	 * Matrix Events
	 */

	eventRoomTimeline(event: MatrixEvent, toStartOfTimeline: boolean | undefined) {
		if (event.event.type === EventType.RoomMessage && event.event.content?.msgtype === MsgType.Text) {
			event.event = this.eventTimeLineHandler.transformEventContent(event.event as Partial<TEvent>);
		}

		if (event.event.type === EventType.RoomMessage && event.event.content?.msgtype === MsgType.Notice) {
			const rooms = useRooms();
			//Messages are only in rooms.
			rooms.addProfileNotice(event.getRoomId()!, event.getContent().body);
		}

		// if (!toStartOfTimeline) {
		// 	if (event.event.type !== EventType.RoomMessage) return;
		// 	const rooms = useRooms();
		// 	rooms.onModRoomMessage(event);
		// }
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
					const pubhubs = usePubhubsStore();
					pubhubs
						.joinRoom(member.roomId)
						.catch((e) => console.debug(e.toString()))
						//This sometimes gives an error when the room cannot be found, maybe it's an old experiment or
						// deleted. Reflects the state, so we just show some debug info.
						.then(function () {
							console.log('joined DM');
						});
				}
				// This case is needed to force the rooms store to update in the miniclient when a user joins a room.
				// Otherwise no notifications would be sent for rooms that are newly joined (only after a refresh the notificiations would be sent).
				// Once the microclients are implemented (see #1128), this case is probably unnecessary.
				else if (member.membership === 'join') {
					const roomId = event.getRoomId();
					if (roomId !== undefined && rooms.rooms[roomId]) {
						if (event.sender?.userId !== me) {
							rooms.rooms[roomId].setHidden(false);
						} else {
							rooms.rooms[roomId].setHidden(false);
						}
					} else {
						const pubhubs = usePubhubsStore();
						pubhubs.updateRooms();
					}
				}
			}
		};
	}
}

export { Events, PubHubsMsgType as PubHubsMgType, PubHubsInvisibleMsgType };
