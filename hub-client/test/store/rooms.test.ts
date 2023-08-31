import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { PubHubsRoomType, Room, useRooms } from '@/store/rooms';

class MockedRoom extends Room {
	_mockedType: string;
	client: any;

	constructor(public readonly roomId: string, type: string = '') {
		super(roomId);
		this._mockedType = type;
		this.client = {
			getUserId: () => {
				return 'A1';
			},
		};
	}

	getMembers() {
		return [{ userId: 'B2' }, { userId: 'A1' }, { userId: 'D4' }, { userId: 'C3' }];
	}

	getMembersWithMembership() {
		return this.getMembers();
	}

	getType() {
		return this._mockedType;
	}
}

describe('rooms Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('Room class', () => {
		test('default', () => {
			const room_id = 'hbadfkjasf';
			const room = new MockedRoom(room_id);
			expect(room).toBeTypeOf('object');
			expect(room.roomId).toEqual(room_id);
		});

		test('getMembersIds', () => {
			const room_id = 'hbadfkjasf';
			const room = new MockedRoom(room_id);
			const memberIds = room.getMembersIds();
			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(4);
			expect(memberIds[0]).toEqual('A1');
			expect(memberIds[3]).toEqual('D4');
		});

		test('getMembersIdsFromName', () => {
			const room_id = 'c3,a1';
			const room = new MockedRoom(room_id);
			expect(room.roomId).toEqual(room_id);
			const memberIds = room.getMembersIdsFromName();
			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(2);
			expect(memberIds[0]).toEqual('a1');
			expect(memberIds[1]).toEqual('c3');
		});

		test('getOtherMembersIds', () => {
			const room_id = 'c3,a1';
			const room = new MockedRoom(room_id);
			expect(room.roomId).toEqual(room_id);
			const memberIds = room.getOtherMembersIds('A1');
			expect(memberIds).toBeTypeOf('object');
			expect(memberIds).toHaveLength(3);
			expect(memberIds[0]).toEqual('B2');
			expect(memberIds[2]).toEqual('D4');
		});

		test('hasExactMembersInName', () => {
			const room_id = 'c3,a1';
			const members = ['a1', 'c3'];
			const room = new MockedRoom(room_id);
			expect(room.roomId).toEqual(room_id);
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
			let room = new MockedRoom(room_id);
			expect(room.roomId).toEqual(room_id);
			let notInvited = room.notInvitedMembersIdsOfPrivateRoom();
			expect(notInvited).toBeTypeOf('object');
			expect(notInvited).toHaveLength(0);
			expect(notInvited).toEqual([]);

			room_id = 'C3,A1,B2,D4,F6,E5';
			room = new MockedRoom(room_id);
			expect(room.roomId).toEqual(room_id);
			notInvited = room.notInvitedMembersIdsOfPrivateRoom();
			expect(notInvited).toBeTypeOf('object');
			expect(notInvited).toHaveLength(2);
			expect(notInvited).toEqual(['E5', 'F6']);
		});

		test('getPrivateRoomNameMembersIds', () => {
			const room = new MockedRoom('bla', PubHubsRoomType.PH_MESSAGES_DM);
			const name = room.getPrivateRoomNameMembers();
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

			const testRoom = new Room('test', {} as any, 'userid');
			rooms.addRoom(testRoom);
			expect(Object.keys(rooms.rooms).length).toEqual(1);
			expect(rooms.rooms['test'].hidden).toEqual(false);
			expect(rooms.rooms['test']).toMatchObject(testRoom);
			rooms.rooms['test'].hidden = true;
			rooms.rooms['test'].unreadMessages = 10;
			expect(rooms.rooms['test'].hidden).toEqual(true);
		});

		test('roomsArray', () => {
			const rooms = useRooms();
			expect(rooms.roomsArray).toBeTypeOf('object');
			expect(rooms.roomsArray.length).toBeTypeOf('number');
		});

		test('sortedRoomsArray', () => {
			const rooms = useRooms();
			rooms.addRoom(new Room('Btest', {} as any, 'userid'));
			rooms.addRoom(new Room('Atest', {} as any, 'userid'));
			rooms.addRoom(new Room('Ctest', {} as any, 'userid'));
			expect(rooms.sortedRoomsArray).toBeTypeOf('object');
			expect(rooms.sortedRoomsArray.length).toBeTypeOf('number');
			expect(rooms.sortedRoomsArray.length).toEqual(rooms.roomsArray.length);
			expect(rooms.sortedRoomsArray).not.toEqual(rooms.roomsArray);
		});

		test('hasRooms', () => {
			const rooms = useRooms();
			expect(rooms.hasRooms).toEqual(false);
			rooms.addRoom(new Room('test', {} as any, 'userid'));
			expect(rooms.hasRooms).toEqual(true);
		});

		test('roomExists', () => {
			const rooms = useRooms();
			expect(rooms.roomExists('test')).toEqual(false);
			rooms.addRoom(new Room('test', {} as any, 'userid'));
			expect(rooms.roomExists('test')).toEqual(true);
		});

		test('room', () => {
			const rooms = useRooms();
			rooms.addRoom(new Room('test', {} as any, 'userid'));
			expect(rooms.room('test')).toBeTypeOf('object');
		});

		test('isHiddenRoom', () => {
			const rooms = useRooms();

			rooms.addRoom(new Room('test', {} as any, 'userid'));
			expect(rooms.rooms['test'].hidden).toEqual(false);

			rooms.rooms['test'].hidden = true;
			expect(rooms.rooms['test'].hidden).toEqual(true);

			rooms.rooms['test'].hidden = false;
			expect(rooms.rooms['test'].hidden).toEqual(false);
		});

		test('unreadMessages', () => {
			const rooms = useRooms();
			expect(rooms.totalUnreadMessages).toEqual(0);

			rooms.addRoom(new Room('test', {} as any, 'userid'));
			rooms.addRoom(new Room('test2', {} as any, 'userid'));

			rooms.rooms['test'].addUnreadMessages(2);
			expect(rooms.rooms['test'].unreadMessages).toEqual(2);
			expect(rooms.totalUnreadMessages).toEqual(2);
			rooms.rooms['test2'].addUnreadMessages(3);
			expect(rooms.rooms['test2'].unreadMessages).toEqual(3);
			expect(rooms.totalUnreadMessages).toEqual(5);
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

			const room = new MockedRoom('a1,b2', PubHubsRoomType.PH_MESSAGES_DM);
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
