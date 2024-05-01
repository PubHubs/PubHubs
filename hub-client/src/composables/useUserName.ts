/**
 *  Get user Information e.g., user's display name.
 *
 */

import { Room } from '@/store/rooms';
import filters from '@/core/filters';

const useUserName = () => {
	function getUserDisplayName(user: string, currentRoom: Room) {
		const member = currentRoom.getMember(user);
		if (member !== null) {
			if (member.user !== undefined && member.user.displayName !== undefined) {
				return member.user.displayName;
			} else if (member.rawDisplayName !== undefined) {
				return member.rawDisplayName;
			}
		}
		return filters.extractPseudonym(user);
	}

	return { getUserDisplayName };
};

const useUserAvatar = () => {
	function getUserAvatar(user: string, currentRoom: Room) {
		const member = currentRoom.getMember(user);
		if (member !== null) {
			if (member.user !== undefined && member.user.avatarUrl !== undefined) {
				return member.user.avatarUrl;
			}
		}
		return '';
	}

	return { getUserAvatar };
};

export { useUserName, useUserAvatar };
