// Models
import { SecuredRoomAttributes } from '@hub-client/models/rooms/TSecuredRoom';

// Types
type TEditRoom = {
	name: string;
	accepted: SecuredRoomAttributes;
	topic: string;
	type: string;
	user_txt: string;
};

type TEditRoomFormAttributes = {
	label: string;
	attribute: string;
	accepted: string[];
	profile: boolean;
};

export { TEditRoom, TEditRoomFormAttributes };
