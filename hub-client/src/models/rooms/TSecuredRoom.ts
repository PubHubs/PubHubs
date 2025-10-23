// Models
import { RoomType, TBaseRoom } from '@hub-client/models/rooms/TBaseRoom';

export interface SecuredRoomAttributes {
	[index: string]: {
		profile: boolean;
		accepted_values: Array<string>;
	};
}

export interface TSecuredRoom extends TBaseRoom {
	accepted?: SecuredRoomAttributes; // | [];  // Gave Typescript problems in compares. Was this really necessary?
	type?: string;
	expiration_time_days?: number;
	room_type?: RoomType.PH_MESSAGES_RESTRICTED;
}
