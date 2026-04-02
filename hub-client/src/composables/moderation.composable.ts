// Models
import Room from '@hub-client/models/rooms/Room';
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

export function useModeration() {
	const rooms = useRooms();

	function stewardSourceRoomName(room: Room): string {
		if (room.getType() !== RoomType.PH_MESSAGE_STEWARD_CONTACT) return '';
		const sourceRoomId = room.name.split(',')[0];
		return rooms.roomList.find((r) => r.roomId === sourceRoomId)?.name ?? rooms.fetchRoomById(sourceRoomId)?.name ?? '';
	}

	return { stewardSourceRoomName };
}
