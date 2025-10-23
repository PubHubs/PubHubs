// Models
import { TUser } from '@hub-client/models/users/TUser';

const createNewPrivateRoomName = (members: Array<TUser>): string => {
	return members.map((m) => `${m.userId}`).join(',');
};

// Show private room name for all members
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
