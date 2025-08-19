import { SecuredRoomAttributes } from '@/model/rooms/TSecuredRoom';

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
