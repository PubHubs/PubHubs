import { MatrixClient, MatrixEvent, ClientEvent, Room as MatrixRoom, RoomEvent, RoomMemberEvent, RoomMember } from 'matrix-js-sdk';

import { useSettings, useUser, useRooms } from '@/store/store';


class Events {

    private client!: MatrixClient;

    constructor(client:MatrixClient) {
        this.client = client;
    }

    initEvents() {
        return new Promise((resolve) => {
            console.debug('initEvents');
            const self = this;
            this.client.on( ClientEvent.Sync, (state: any) => {
                console.debug('SYNC: ', state);

                if (state=="PREPARED") {
                    // this.client.on("event", (event) => {
                    //     console.debug('== EVENT', event.getType());
                    // })
                    this.client.on(RoomEvent.Name, self.eventRoomName );
                    this.client.on(RoomEvent.Timeline, self.eventRoomTimeline );
                    this.client.on(RoomMemberEvent.Name, self.eventRoomMemberName );
                    this.client.on(RoomMemberEvent.Membership, self.eventRoomMemberMembership );

                    resolve(true);
                }

            });

            // Start client sync
            const settings = useSettings();
            this.client.startClient({
                initialSyncLimit: settings.pagination,
                includeArchivedRooms :false,
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
        console.debug("Room.timeline", toStartOfTimeline, removed);
        if (room != undefined) {
            if (toStartOfTimeline) {
                rooms.addMatrixRoom(room);
            }
            else {
                rooms.addMatrixRoom(room);
                if (event.event.type == 'm.room.message' && room.roomId!==rooms.currentRoomId) rooms.rooms[room.roomId].unreadMessages++;
            }
        }
    }

    eventRoomMemberName(event: MatrixEvent, member: RoomMember) {
        const user = useUser();
        console.debug("RoomMember.name",member.user?.displayName);
        if (member.user!==undefined) {
            user.setUser(member.user);
            user.user.setDisplayName(member.user.displayName);
        }
    }

    eventRoomMemberMembership(event: MatrixEvent, member: RoomMember) {
        const rooms = useRooms();
        console.debug('RoomMember.membership', member.membership, event.getRoomId());
        if (member.membership == "leave") {
            const roomId = event.getRoomId();
            if (roomId != undefined) {
                rooms.rooms[roomId].hidden = true;
            }
        }
    }


}


export { Events }
