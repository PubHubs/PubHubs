// Models
import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
import { TUser, TUserAccount } from '@hub-client/models/users/TUser';
import { FieldOption, FieldOptions } from '@hub-client/models/validation/TFormOption';

import { useRooms } from '@hub-client/stores/rooms';
// Stores
import { useUser } from '@hub-client/stores/user';

export const transformBack = (item: FieldOption): any => {
	if (item.data) return item.data;
	return item;
};

export const transformUser = (user: TUserAccount | TUser): FieldOption => {
	const userStore = useUser();
	let userId = '';
	let displayname = '';
	if (user.userId) {
		userId = (user as TUser).userId;
		displayname = (user as TUser).rawDisplayName as string;
	} else {
		userId = (user as TUserAccount).name;
		displayname = (user as TUserAccount).displayname;
	}
	let avatar = userStore.userAvatar(userId);
	if (typeof avatar === 'undefined') avatar = '';
	return {
		value: userId,
		label: displayname,
		avatar: avatar,
		data: user,
	};
};

export const transformUsers = (users: TUserAccount[] | TUser[]): FieldOptions => {
	const userOptions = users.map((user) => {
		return transformUser(user);
	});
	return userOptions;
};

export const transformRoom = (room: TPublicRoom): FieldOption => {
	return {
		value: room.room_id,
		label: room.name as string,
		data: room,
	};
};

export const transformRooms = (rooms: Array<TPublicRoom>): FieldOptions => {
	const roomOptions = rooms.map((room) => {
		return transformRoom(room);
	});
	return roomOptions;
};

export function useDropDownData() {
	// Users
	const userList = async (excludeUserIds: Array<string> | undefined = undefined): Promise<FieldOptions> => {
		let users = await ManagementUtils.getUsersAccounts();
		if (excludeUserIds) {
			users = users.filter((user) => {
				return !excludeUserIds.includes(user.name);
			});
		}
		return transformUsers(users);
	};

	const userListWithoutMe = async () => {
		const userStore = useUser();
		const me = userStore.userId;
		return await userList([me]);
	};

	// Members of a room
	// const memberList = (roomId:string) => {
	// }

	// const memberListWithoutMe = (roomId:string) => {
	// }

	// Rooms

	const publicRoomList = async (addedRoom = {}): Promise<FieldOptions> => {
		const roomsStore = useRooms();
		await roomsStore.fetchPublicRooms();
		const rooms = roomsStore.publicRooms;
		if (rooms) {
			const roomOptions = transformRooms(rooms);
			return roomOptions;
		}
		return [];
	};

	return { userList, userListWithoutMe, publicRoomList };
}
