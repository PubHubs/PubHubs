import { setActivePinia, createPinia } from 'pinia';
import { describe, beforeEach, expect, test } from 'vitest';
import { Room, useRooms } from '@/store/rooms';

describe('rooms Store', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
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
	});
});
