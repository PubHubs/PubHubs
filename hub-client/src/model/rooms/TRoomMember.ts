import { TUser } from '../users/TUser';

export type TRoomMember = {
	rawDisplayName: string;
	membership?: string;
	user?: TUser;
	userId: string;
};
