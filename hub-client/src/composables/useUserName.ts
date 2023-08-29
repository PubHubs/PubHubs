/**
 *  Get user Information e.g., user's display name.
 *
 */

import { Room } from '@/store/rooms';

const useUserName = () => {
	function getUserDisplayName(user: string, currentRoom: Room) {
		const member = currentRoom.getMember(user);
		if (member != null) {
			if (member.user != undefined && member.user.displayName != undefined) {
				return member.user.displayName;
			} else if (member.rawDisplayName != undefined) {
				return member.rawDisplayName;
			}
		}
		return user;
	}

	return { getUserDisplayName };
};

export { useUserName };