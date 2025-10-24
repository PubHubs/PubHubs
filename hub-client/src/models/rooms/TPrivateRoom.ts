// Models
import { RoomType, TBaseRoom } from '@hub-client/models/rooms/TBaseRoom';

export interface TPrivateRoom extends TBaseRoom {
	room_type: RoomType.PH_MESSAGES_DM;
}
