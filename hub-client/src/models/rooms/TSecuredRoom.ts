// Models
import { type RoomType, type TBaseRoom } from '@hub-client/models/rooms/TBaseRoom';

export type SecuredRoomAttributes = {
	[index: string]: {
		profile: boolean;
		accepted_values: Array<string>;
	};
};

export type TSecuredRoom = TBaseRoom & {
	accepted?: SecuredRoomAttributes; // | [];  // Gave Typescript problems in compares. Was this really necessary?
	type?: string;
	expiration_time_days?: number;
	room_type?: RoomType.PH_MESSAGES_RESTRICTED;
};

export type TSecuredRoomPublicMetadata = {
	room_id?: string;
	name?: string;
	topic?: string;
	type?: string;
	user_txt?: string;
	expiration_time_days?: number;
	accepted?: string[];
};
