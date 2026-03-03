// Models
import { useI18n } from 'vue-i18n';

import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
import { TUser, TUserAccount } from '@hub-client/models/users/TUser';
import { FieldOption } from '@hub-client/models/validation/TFormOption';
import { Attribute } from '@hub-client/models/yivi/Tyivi';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';
import { useYivi } from '@hub-client/stores/yivi';

const useDropDownData = () => {
	/**
	 * Every transformed data object (to FieldOption) keeps the original object inside `.data`, so it is easy to transform back for whatever form the original data had.
	 */
	const transformBack = (item: FieldOption): any => {
		if (item.data) return item.data;
		return item;
	};

	const transformUser = (user: TUserAccount | TUser): FieldOption => {
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

	const transformRoom = (room: TPublicRoom): FieldOption => {
		return {
			value: room.room_id,
			label: room.name as string,
			icon: room.room_type === RoomType.PH_MESSAGES_RESTRICTED ? 'shield' : 'chats-circle',
			data: room,
		};
	};

	const transformYiviAttribute = (attribute: Attribute): FieldOption => {
		return {
			value: attribute.attribute,
			label: attribute.label,
			data: attribute,
		};
	};

	// Users
	const userList = async (excludeUserIds: Array<string> | undefined = undefined): Promise<TUserAccount[]> => {
		let users = await ManagementUtils.getUsersAccounts();
		if (excludeUserIds) {
			users = users.filter((user) => {
				return !excludeUserIds.includes(user.name);
			});
		}
		return users;
	};

	const userListWithoutMe = async () => {
		const userStore = useUser();
		const me = userStore.userId;
		return await userList([me]);
	};

	// TODO: Members of a room
	// const memberList = (roomId:string) => {
	// }
	// const memberListWithoutMe = (roomId:string) => {
	// }

	// Rooms
	const publicRoomList = async (addedRoom = {}): Promise<Array<TPublicRoom>> => {
		const roomsStore = useRooms();
		await roomsStore.fetchPublicRooms();
		const rooms = roomsStore.publicRooms;
		return rooms;
	};

	const yiviAttributes = (): Array<Attribute> => {
		const { t } = useI18n();
		return useYivi().getAttributes(t);
	};

	return { transformBack, transformUser, transformRoom, transformYiviAttribute, userList, userListWithoutMe, publicRoomList, yiviAttributes };
};

export { useDropDownData };
