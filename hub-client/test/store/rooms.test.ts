// Packages
import { EventTimelineSet, Filter, NotificationCountType } from 'matrix-js-sdk';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Models
import Room from '@hub-client/models/rooms/Room';
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

/**
 * The Room class uses Matrix's Room class internally.
 * By mocking the matrix Room class,
 * we only test what the methods we've written do with the output we expect from Matrix's room class.
 * This way we don't have to spin up the whole matrix-js-sdk when testing (but we don't test matrix-js-sdk's behaviour).
 */
class MockedMatrixRoom {
	public client: any;
	public roomId: string;
	public name: string;
	private type: RoomType;
	public stateEvents: [];

	constructor(roomId: string, type: RoomType = RoomType.PH_MESSAGES_DM) {
		this.client = {
			getUserId: () => {
				return 'A1';
			},
		};
		this.roomId = roomId;
		this.name = roomId;
		this.type = type;
	}

	public getMembersWithMembership() {
		return [{ userId: 'B2' }, { userId: 'A1' }, { userId: 'D4' }, { userId: 'C3' }];
	}

	public getMembers() {
		return [{ userId: 'B2' }, { userId: 'A1' }, { userId: 'D4' }, { userId: 'C3' }];
	}

	public getType() {
		return this.type;
	}

	public getRoomUnreadNotificationCount(type: NotificationCountType) {
		if (NotificationCountType && NotificationCountType.Highlight) return 1;
		if (NotificationCountType && NotificationCountType.Total) return 1;
	}

	public getOrCreateFilteredTimelineSet(filter: Filter) {
		return new EventTimelineSet(undefined);
	}

	public createThreadsTimelineSets() {
		// returns nothing
	}
}

const MockedStateEvents = [
	{
		type: 'm.room.create',
		sender: 'AA',
		content: { room_version: '10', creator: '@alice:example.org' },
		state_key: '',
		origin_server_ts: 1234567890000,
		unsigned: { age: 1000 },
		event_id: '$event0',
	},
	{
		type: 'm.room.member',
		sender: 'A1',
		content: { displayname: 'Bob', membership: 'join' },
		state_key: 'A1',
		origin_server_ts: 1234567891000,
		unsigned: { age: 2000 },
		event_id: '$event1',
	},
	{
		type: 'm.room.member',
		sender: 'B1',
		content: { displayname: 'Alice', membership: 'join' },
		state_key: 'B1',
		origin_server_ts: 1234567892000,
		unsigned: { age: 3000 },
		event_id: '$event2',
	},
];

describe('rooms Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('Room class', () => {
		test('default', () => {
			const mockedMatrixRoom = new MockedMatrixRoom('test-room-id');
			const room = new Room(mockedMatrixRoom);
			expect(room).toBeTypeOf('object');
			expect(room.roomId).toEqual('test-room-id');
		});

		test('getMembersIds', () => {
			const mockedMatrixRoom = new MockedMatrixRoom('test-room-id');
			const room = new Room(mockedMatrixRoom, RoomType.PH_MESSAGES_DEFAULT, MockedStateEvents);
			const memberIds = room.getMembersIds();

			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(2);
			expect(memberIds[0]).toEqual('A1');
			expect(memberIds[1]).toEqual('B1');
		});

		test('getMembersIdsFromName', () => {
			const room_id = 'c3,a1';
			const room = new Room(new MockedMatrixRoom(room_id, MockedStateEvents));
			const memberIds = room.getMembersIdsFromName();
			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(2);
			expect(memberIds[0]).toEqual('a1');
			expect(memberIds[1]).toEqual('c3');
		});

		test('hasExactMembersInName', () => {
			const room_id = 'c3,a1';
			const members = ['a1', 'c3'];
			const room = new Room(new MockedMatrixRoom(room_id));
			let isExact = room.hasExactMembersInName(members);
			expect(isExact).toBeTypeOf('boolean');
			expect(isExact).toEqual(true);
			isExact = room.hasExactMembersInName(['bla']);
			expect(isExact).toBeTypeOf('boolean');
			expect(isExact).toEqual(false);
			isExact = room.hasExactMembersInName(['c3', 'a1']);
			expect(isExact).toBeTypeOf('boolean');
			expect(isExact).toEqual(true);
		});

		//TODO:  When private room methods will change based on sliding sync this test will be update accordingly.
		// The implementation of notInvitedMembersIdsOfPrivateRoom() is still not updated with sliding sync

		// test('notInvitedMembersIdsOfPrivateRoom', () => {
		// 	let room_id = 'C3,A1,B2,D4';
		// 	let room = new Room(new MockedMatrixRoom(room_id), RoomType.PH_MESSAGES_DM, MockedStateEvents);
		// 	expect(room.roomId).toEqual(room_id);
		// 	let notInvited = room.notInvitedMembersIdsOfPrivateRoom();
		// 	expect(notInvited).toBeTypeOf('object');
		// 	expect(notInvited).toHaveLength(0);
		// 	expect(notInvited).toEqual([]);

		// 	room_id = 'C3,A1,B2,D4,F6,E5';
		// 	room = new Room(new MockedMatrixRoom(room_id), RoomType.PH_MESSAGES_DM, MockedStateEvents);
		// 	expect(room.roomId).toEqual(room_id);
		// 	notInvited = room.notInvitedMembersIdsOfPrivateRoom();
		// 	expect(notInvited).toBeTypeOf('object');
		// 	expect(notInvited).toHaveLength(2);
		// 	expect(notInvited).toEqual(['E5', 'F6']);
		// });

		test('getOtherMembers', () => {
			const room = new Room(new MockedMatrixRoom('test_id'));
			const name = room.getOtherJoinedMembers();
			expect(name).toBeTypeOf('object');
			expect(name).toHaveLength(3);
			expect(name[0].userId).toEqual('B2');
		});
	});

	describe('rooms', () => {
		test('default', () => {
			const rooms = useRooms();
			expect(rooms).toBeTypeOf('object');
		});

		test('roomsArray', () => {
			const rooms = useRooms();
			expect(rooms.roomsArray).toBeTypeOf('object');
			expect(rooms.roomsArray.length).toBeTypeOf('number');
		});

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('sortedRoomsArray', () => {
		// 	const rooms = useRooms();
		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('Btest')), new Room(new MockedMatrixRoom('Atest')), new Room(new MockedMatrixRoom('Ctest'))]);
		// 	expect(rooms.sortedRoomsArray).toBeTypeOf('object');
		// 	expect(rooms.sortedRoomsArray.length).toBeTypeOf('number');
		// 	expect(rooms.sortedRoomsArray.length).toEqual(rooms.roomsArray.length);
		// 	expect(rooms.sortedRoomsArray).not.toEqual(rooms.roomsArray);
		// });

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('hasRooms', () => {
		// 	const rooms = useRooms();
		// 	expect(rooms.hasRooms).toEqual(false);
		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('test'))]);
		// 	expect(rooms.hasRooms).toEqual(true);
		// });

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('roomExists', () => {
		// 	const rooms = useRooms();
		// 	expect(rooms.roomExists('test')).toEqual(false);
		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('test'))]);
		// 	expect(rooms.roomExists('test')).toEqual(true);
		// });

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('room', () => {
		// 	const rooms = useRooms();
		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('test'))]);
		// 	expect(rooms.room('test')).toBeTypeOf('object');
		// });

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('isHiddenRoom', () => {
		// 	const rooms = useRooms();

		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('test'))]);
		// 	expect(rooms.rooms['test'].hidden).toEqual(false);

		// 	rooms.rooms['test'].hidden = true;
		// 	expect(rooms.rooms['test'].hidden).toEqual(true);

		// 	rooms.rooms['test'].hidden = false;
		// 	expect(rooms.rooms['test'].hidden).toEqual(false);
		// });

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('unreadMessages', () => {
		// 	const rooms = useRooms();
		// 	expect(rooms.totalUnreadMessages).toEqual(0);

		// 	rooms.updateRoomsWithMatrixRooms([new Room(new MockedMatrixRoom('test')), new Room(new MockedMatrixRoom('test2'))]);

		// 	expect(rooms.rooms['test'].getRoomUnreadNotificationCount(NotificationCountType.Highlight)).toEqual(1);
		// 	expect(rooms.rooms['test'].getRoomUnreadNotificationCount(NotificationCountType.Total)).toEqual(1);
		// });

		test('PublicRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasPublicRooms).toEqual(false);
		});

		test('SecuredRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasSecuredRooms).toEqual(false);
		});

		// Temporary removed because of TypeError: matrixRoom.getOrCreateFilteredTimelineSet is not a function
		// test('PrivateRooms', () => {
		// 	const rooms = useRooms();
		// 	expect(rooms.privateRooms).toEqual([]);

		// 	const room = new Room(new MockedMatrixRoom('a1,b2', RoomType.PH_MESSAGES_DM));
		// 	rooms.updateRoomsWithMatrixRoom(room, '');

		// 	expect(rooms.privateRooms).toHaveLength(1);
		// });
	});
});
