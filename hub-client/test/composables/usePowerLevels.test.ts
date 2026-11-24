// Packages
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';

// Composables
import { usePowerLevels } from '@hub-client/composables/usePowerLevels';

// Models
import { type RoomListRoom, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

const powerLevelRoom = (roomId: string, users: Record<string, number>, users_default = 0, roomType = ''): RoomListRoom => ({
	roomId,
	roomType,
	name: roomId,
	isHidden: false,
	unreadState: 'unknown',
	stateEvents: [
		{
			type: 'm.room.power_levels',
			sender: 'A1',
			content: { users, users_default },
			state_key: '',
			origin_server_ts: 0,
			unsigned: { age: 0 },
			event_id: `$pl-${roomId}`,
		},
	],
});

describe('usePowerLevels', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	describe('powerLevel', () => {
		test('reads room list state for rooms that are not loaded', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [powerLevelRoom('!a', { A1: 50, B2: 25 })];
			const { powerLevel } = usePowerLevels();
			expect(powerLevel('!a')).toEqual(50);
			expect(powerLevel('!a', 'B2')).toEqual(25);
			expect(powerLevel('!a', 'C3')).toEqual(0);
		});

		test('returns 0 for unknown rooms', () => {
			useUser().userId = 'A1';
			expect(usePowerLevels().powerLevel('!unknown')).toEqual(0);
		});
	});

	describe('roomsWithPowerLevel', () => {
		test('returns non-DM rooms at or above the level', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [
				powerLevelRoom('!a', { A1: 50 }),
				powerLevelRoom('!b', { A1: 25 }),
				powerLevelRoom('!c', { A1: 100 }),
				powerLevelRoom('!dm', { A1: 100 }, 0, RoomType.PH_MESSAGES_DM),
			];
			expect(
				usePowerLevels()
					.roomsWithPowerLevel(UserPowerLevel.Steward)
					.map((r) => r.roomId),
			).toEqual(['!a', '!c']);
		});
	});

	describe('maxRoomPowerLevel', () => {
		test('returns 0 when user has no userId', () => {
			useRooms().roomList = [powerLevelRoom('!a', { A1: 100 })];
			expect(usePowerLevels().maxRoomPowerLevel()).toEqual(0);
		});

		test('returns highest power level across rooms', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [powerLevelRoom('!a', { A1: 0 }), powerLevelRoom('!b', { A1: 50 }), powerLevelRoom('!c', { A1: 25 })];
			expect(usePowerLevels().maxRoomPowerLevel()).toEqual(50);
		});

		test('falls back to users_default when user not in users map', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [powerLevelRoom('!a', { B2: 100 }, 50)];
			expect(usePowerLevels().maxRoomPowerLevel()).toEqual(50);
		});

		test('ignores direct message rooms', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [powerLevelRoom('!dm', { A1: 100 }, 0, RoomType.PH_MESSAGES_DM)];
			expect(usePowerLevels().maxRoomPowerLevel()).toEqual(0);
		});

		test('returns 0 when no power-level events are present', () => {
			useUser().userId = 'A1';
			useRooms().roomList = [{ roomId: '!a', roomType: '', name: '', stateEvents: [], isHidden: false, unreadState: 'unknown' }];
			expect(usePowerLevels().maxRoomPowerLevel()).toEqual(0);
		});
	});
});
