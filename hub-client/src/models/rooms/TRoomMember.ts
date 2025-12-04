// Models
import { TUser } from '@hub-client/models/users/TUser';

export type TRoomMember = {
	rawDisplayName: string;
	membership?: string;
	user?: TUser;
	userId: string;
};
