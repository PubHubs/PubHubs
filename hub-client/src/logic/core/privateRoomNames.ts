const createNewPrivateRoomName = (members: Array<string>): string => {
	return members.join(',');
};

// Show private room name for all members
const refreshPrivateRoomName = (name: string): string => {
	const members = fetchMemberIdsFromPrivateRoomName(name);
	return createNewPrivateRoomName(members);
};

const updatePrivateRoomName = (name: string, memberId: string, hideMe: boolean): string => {
	if (!name) return '';
	return name
		.split(',')
		.map((memberName) => {
			if (hideMe && memberId === memberName) {
				return '_' + memberId;
			} else if (!hideMe && memberId === memberName.substring(1)) {
				return memberId;
			} else {
				return memberName;
			}
		})
		.join(',');
};

const isVisiblePrivateRoom = (name: string, memberId: string): boolean => {
	if (!name) return false;
	return name.split(',').some((memberName) => memberName === memberId);
};

const fetchMemberIdsFromPrivateRoomName = (name: string): Array<string> => {
	if (!name) return [];
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
