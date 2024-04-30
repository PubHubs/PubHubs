import { TBaseRoom, RoomType } from './TBaseRoom';

export interface SecuredRoomAttributes {
	[index: string]: {
		profile: boolean;
		accepted_values: Array<string>;
	};
}

export interface TSecuredRoom extends TBaseRoom {
	accepted?: SecuredRoomAttributes | [];
	type?: string;
	expiration_time_days?: number;
	room_type?: RoomType.PH_MESSAGES_RESTRICTED;
}
