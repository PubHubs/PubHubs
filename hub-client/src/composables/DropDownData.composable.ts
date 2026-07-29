// Packages
import { EventType } from 'matrix-js-sdk';
import { useI18n } from 'vue-i18n';

// Models
import { DisclosurePurpose } from '@hub-client/models/components/signedMessages';
import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { type TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
import { type TUser, type TUserAccount, UserPowerLevel } from '@hub-client/models/users/TUser';
import { type FieldOption } from '@hub-client/models/validation/TFormOption';
import { type Attribute } from '@hub-client/models/yivi/Tyivi';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';
import { useYivi } from '@hub-client/stores/yivi';

// Types
type PurposeOption = {
	value: DisclosurePurpose;
	label: string;
};

const useDropDownData = () => {
	/**
	 * Every transformed data object (to FieldOption) keeps the original object inside `.data`, so it is easy to transform back for whatever form the original data had.
	 */
	const transformBack = (item: FieldOption): unknown => {
		if (item.data) return item.data;
		return item;
	};

	const transformUser = (user: TUserAccount | TUser): FieldOption => {
		const userStore = useUser();
		let userId = '';
		let displayname = '';
		if (!user) {
			return {
				value: '',
				label: '',
				data: undefined,
			};
		} else {
			if ((user as TUser).userId) {
				userId = (user as TUser).userId;
				displayname = (user as TUser).rawDisplayName as string;
			} else {
				userId = (user as TUserAccount).name;
				displayname = (user as TUserAccount).displayname || userId;
			}
			const avatar = userStore.userAvatar(userId) ?? '';
			return {
				value: userId,
				label: displayname,
				avatar: avatar,
				data: user,
			};
		}
	};

	const transformRoom = (room: TPublicRoom): FieldOption => {
		if (room) {
			return {
				value: room.room_id,
				label: room.name as string,
				icon: room.room_type === RoomType.PH_MESSAGES_RESTRICTED ? 'shield' : 'chats-circle',
				data: room,
			};
		}
		return {
			value: '',
			label: '',
			data: undefined,
		};
	};

	const transformYiviAttribute = (attribute: Attribute): FieldOption => {
		return {
			value: attribute.attribute,
			label: attribute.label ?? '',
			data: attribute,
		};
	};

	const transformPurpose = (purpose: PurposeOption): FieldOption => {
		return {
			value: purpose.value,
			label: purpose.label,
			data: purpose,
		};
	};

	const purposeOptions = (): PurposeOption[] => {
		const { t } = useI18n();
		return [
			{ value: DisclosurePurpose.Steward, label: t('roles.type_steward') },
			{ value: DisclosurePurpose.Expert, label: t('roles.type_expert') },
			{ value: DisclosurePurpose.Information, label: t('roles.type_information') },
		];
	};

	/**
	 * Fetch users from rooms the current user moderates (steward-level access).
	 * Returns minimal TUserAccount objects with only essential fields populated.
	 * Used as fallback when admin API is not available.
	 */
	const fetchUsersFromModeratedRooms = (): TUserAccount[] => {
		const userStore = useUser();
		const roomsStore = useRooms();
		const userId = userStore.userId;
		if (!userId) return [];

		const userMap = new Map<string, TUserAccount>();

		for (const entry of roomsStore.roomList) {
			if (DirectRooms.includes(entry.roomType as RoomType)) continue;

			const powerLevelEvent = entry.stateEvents.find((e) => e.type === EventType.RoomPowerLevels);
			if (!powerLevelEvent) continue;
			const myPl = powerLevelEvent.content?.users?.[userId] ?? powerLevelEvent.content?.users_default ?? 0;
			if (myPl < UserPowerLevel.Steward) continue;

			const myMembership = entry.stateEvents.find((e) => e.type === EventType.RoomMember && e.state_key === userId);
			if (myMembership?.content?.membership !== 'join') continue;

			const memberEvents = entry.stateEvents.filter(
				(e) => e.type === EventType.RoomMember && e.content?.membership === 'join' && !e.state_key.startsWith('@notices_user:'),
			);

			for (const memberEvent of memberEvents) {
				const memberId = memberEvent.state_key;
				if (userMap.has(memberId)) continue;

				// Get display name and avatar from member event or user store
				const displayname = memberEvent.content?.displayname || userStore.userDisplayName(memberId) || memberId;
				const avatarUrl = memberEvent.content?.avatar_url || userStore.userAvatar(memberId) || '';

				userMap.set(memberId, {
					name: memberId,
					displayname,
					avatar_url: avatarUrl,
					// Fields below are not available from room state, using safe defaults
					admin: false,
					user_type: null,
					is_guest: false,
					deactivated: false,
					shadow_banned: false,
					creation_ts: 0,
					approved: true,
					erased: false,
					last_seen_ts: null,
					locked: false,
				});
			}
		}

		return Array.from(userMap.values());
	};

	const userList = async (excludeUserIds: Array<string> | undefined = undefined): Promise<TUserAccount[]> => {
		const userStore = useUser();
		let users: TUserAccount[];

		// Try admin API first, fall back to steward method
		if (userStore.isAdministrator) {
			try {
				users = await ManagementUtils.getUsersAccounts();
			} catch {
				// Fall back to steward method if admin API fails
				users = fetchUsersFromModeratedRooms();
			}
		} else {
			// Stewards get users from rooms they moderate
			users = fetchUsersFromModeratedRooms();
		}

		if (excludeUserIds) {
			users = users.filter((user) => {
				return !excludeUserIds.includes(user.name);
			});
		}
		return users;
	};

	const userListWithoutMe = async () => {
		const userStore = useUser();
		const me = userStore.userId ?? '';
		return await userList([me]);
	};

	// TODO: Members of a room
	// const memberList = (roomId:string) => {
	// }
	// const memberListWithoutMe = (roomId:string) => {
	// }

	// Rooms
	const publicRoomList = async (): Promise<Array<TPublicRoom>> => {
		const roomsStore = useRooms();
		await roomsStore.fetchPublicRooms();
		const rooms = roomsStore.publicRooms;
		return rooms;
	};

	const yiviAttributes = (): Array<Attribute> => {
		const { t } = useI18n();
		return useYivi().getAttributes(t);
	};

	return {
		transformBack,
		transformUser,
		transformRoom,
		transformYiviAttribute,
		transformPurpose,
		userList,
		userListWithoutMe,
		publicRoomList,
		yiviAttributes,
		purposeOptions,
	};
};

export { useDropDownData };
