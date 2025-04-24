/**
 * Private Room Names are special:
 * - It exists of the userId's seperated by a comma, so for example `@me:server.nl,@you.server.nl`
 * - The name will inform the client if the private room is hidden for a specific user by adding an underscore in front: `_@me:server.nl,@you.server.nl` or `@me:server.nl,_@you.server.nl` or `_@me:server.nl,_@you.server.nl`
 * - The functions in this file are helper functions for creating and changinge the room name. You still need to call pubhubs.renameRoom() to actualy change the name.
 */

import { TUser } from '@/model/users/TUser';

const createNewPrivateRoomName = (members: Array<TUser>): string => {
	return members.map((m) => `${m.userId}`).join(',');
};

// show private room name for all members
const refreshPrivateRoomName = (name: string): string => {
	const members = fetchMemberIdsFromPrivateRoomName(name).map((n) => ({
		userId: n,
	}));
	return createNewPrivateRoomName(members);
};

const updatePrivateRoomName = (name: string, member: TUser, hideMe: boolean): string => {
	const userId = member.userId;
	return name
		.split(',')
		.map((memberName) => {
			if (hideMe && userId === memberName) {
				return '_' + userId;
			} else if (!hideMe && userId === memberName.substring(1)) {
				return userId;
			} else {
				return memberName;
			}
		})
		.join(',');
};

const isVisiblePrivateRoom = (name: string, member: TUser): boolean => {
	const userId = member.userId;
	return name.split(',').some((memberName) => memberName === userId);
};

const fetchMemberIdsFromPrivateRoomName = (name: string): Array<string> => {
	let memberIDs = name.split(',');
	// Matrix names specification https://spec.matrix.org/latest/appendices/#user-identifiers
	memberIDs = memberIDs.map((m) => {
		if (m.startsWith('_@')) {
			return m.substring(1);
		} else {
			return m;
		}
	});
	return memberIDs;
};

export { createNewPrivateRoomName, refreshPrivateRoomName, updatePrivateRoomName, isVisiblePrivateRoom, fetchMemberIdsFromPrivateRoomName };
