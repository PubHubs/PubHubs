import { TBaseRoom, RoomType } from './TBaseRoom';

export interface TPrivateRoom extends TBaseRoom {
	room_type: RoomType.PH_MESSAGES_DM;
}
