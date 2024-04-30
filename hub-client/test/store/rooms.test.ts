import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import Room from '@/model/rooms/Room';
import { RoomType } from '@/model/model';
import { useRooms } from '@/store/rooms';

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
}

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
			const room = new Room(mockedMatrixRoom);
			const memberIds = room.getMembersIds();
			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(4);
			expect(memberIds[0]).toEqual('A1');
			expect(memberIds[3]).toEqual('D4');
		});

		test('getMembersIdsFromName', () => {
			const room_id = 'c3,a1';
			const room = new Room(new MockedMatrixRoom(room_id));
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

		test('notInvitedMembersIdsOfPrivateRoom', () => {
			let room_id = 'C3,A1,B2,D4';
			let room = new Room(new MockedMatrixRoom(room_id));
			expect(room.roomId).toEqual(room_id);
			let notInvited = room.notInvitedMembersIdsOfPrivateRoom();
			expect(notInvited).toBeTypeOf('object');
			expect(notInvited).toHaveLength(0);
			expect(notInvited).toEqual([]);

			room_id = 'C3,A1,B2,D4,F6,E5';
			room = new Room(new MockedMatrixRoom(room_id));
			expect(room.roomId).toEqual(room_id);
			notInvited = room.notInvitedMembersIdsOfPrivateRoom();
			expect(notInvited).toBeTypeOf('object');
			expect(notInvited).toHaveLength(2);
			expect(notInvited).toEqual(['E5', 'F6']);
		});

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

		test('addRoom', () => {
			const rooms = useRooms();
			expect(Object.keys(rooms.rooms).length).toEqual(0);

			const testRoom = new Room(new MockedMatrixRoom('test'));
			rooms.addRoom(testRoom);
			expect(Object.keys(rooms.rooms).length).toEqual(1);
			expect(rooms.rooms['test'].isHidden()).toEqual(false);
			expect(rooms.rooms['test']).toMatchObject(testRoom);
			rooms.rooms['test'].numUnreadMessages = 10;
		});

		test('roomsArray', () => {
			const rooms = useRooms();
			expect(rooms.roomsArray).toBeTypeOf('object');
			expect(rooms.roomsArray.length).toBeTypeOf('number');
		});

		test('sortedRoomsArray', () => {
			const rooms = useRooms();
			rooms.addRoom(new Room(new MockedMatrixRoom('Btest')));
			rooms.addRoom(new Room(new MockedMatrixRoom('Atest')));
			rooms.addRoom(new Room(new MockedMatrixRoom('Ctest')));
			expect(rooms.sortedRoomsArray).toBeTypeOf('object');
			expect(rooms.sortedRoomsArray.length).toBeTypeOf('number');
			expect(rooms.sortedRoomsArray.length).toEqual(rooms.roomsArray.length);
			expect(rooms.sortedRoomsArray).not.toEqual(rooms.roomsArray);
		});

		test('hasRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasRooms).toEqual(false);
			rooms.addRoom(new Room(new MockedMatrixRoom('test')));
			expect(rooms.hasRooms).toEqual(true);
		});

		test('roomExists', () => {
			const rooms = useRooms();
			expect(rooms.roomExists('test')).toEqual(false);
			rooms.addRoom(new Room(new MockedMatrixRoom('test')));
			expect(rooms.roomExists('test')).toEqual(true);
		});

		test('room', () => {
			const rooms = useRooms();
			rooms.addRoom(new Room(new MockedMatrixRoom('test')));
			expect(rooms.room('test')).toBeTypeOf('object');
		});

		test('isHiddenRoom', () => {
			const rooms = useRooms();

			rooms.addRoom(new Room(new MockedMatrixRoom('test')));
			expect(rooms.rooms['test'].hidden).toEqual(false);

			rooms.rooms['test'].hidden = true;
			expect(rooms.rooms['test'].hidden).toEqual(true);

			rooms.rooms['test'].hidden = false;
			expect(rooms.rooms['test'].hidden).toEqual(false);
		});

		test('unreadMessages', () => {
			const rooms = useRooms();
			expect(rooms.totalUnreadMessages).toEqual(0);

			rooms.addRoom(new Room(new MockedMatrixRoom('test')));
			rooms.addRoom(new Room(new MockedMatrixRoom('test2')));

			// todo function doesn't exist anymore, add alternative?
			// rooms.rooms['test'].addUnreadMessages(2);
			// expect(rooms.rooms['test'].unreadMessages).toEqual(2);
			// expect(rooms.totalUnreadMessages).toEqual(2);
			// rooms.rooms['test2'].addUnreadMessages(3);
			// expect(rooms.rooms['test2'].unreadMessages).toEqual(3);
			// expect(rooms.totalUnreadMessages).toEqual(5);
		});

		test('PublicRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasPublicRooms).toEqual(false);
		});

		test('SecuredRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasSecuredRooms).toEqual(false);
		});

		test('PrivateRooms', () => {
			const rooms = useRooms();
			expect(rooms.privateRooms).toEqual([]);

			const room = new Room(new MockedMatrixRoom('a1,b2', RoomType.PH_MESSAGES_DM));
			rooms.rooms[room.roomId] = room;

			expect(rooms.privateRooms).toHaveLength(1);

			let members = ['a1', 'b2'];
			expect(rooms.privateRoomWithMembersExist(members)).toBeTypeOf('string');
			expect(rooms.privateRoomWithMembersExist(members)).toEqual('a1,b2');
			members = ['b2', 'a1'];
			expect(rooms.privateRoomWithMembersExist(members)).toBeTypeOf('string');
			expect(rooms.privateRoomWithMembersExist(members)).toEqual('a1,b2');
			members = ['c3', 'a1'];
			expect(rooms.privateRoomWithMembersExist(members)).toBeTypeOf('boolean');
			expect(rooms.privateRoomWithMembersExist(members)).toEqual(false);
		});
	});
});
