// Models
import { type SecuredRoomAttributes } from '@hub-client/models/rooms/TSecuredRoom';

// Types
type TEditRoom = {
	name: string;
	accepted?: SecuredRoomAttributes;
	expiration_time_days?: number;
	topic: string;
	type: string;
	room_type?: string;
	user_txt: string;
};

type TEditRoomFormAttributes = {
	label: string;
	attribute: string;
	accepted: string[];
	profile: boolean;
};

export { TEditRoom, TEditRoomFormAttributes };
