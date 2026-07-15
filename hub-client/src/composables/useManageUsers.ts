// Packages
import { EventType } from 'matrix-js-sdk';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

// Composables
import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

// Logic
import { router } from '@hub-client/logic/core/router';

// Models
import { type Administrator } from '@hub-client/models/hubmanagement/models/admin';
import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { DirectRooms, type RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { type TUserAccount, UserPowerLevel } from '@hub-client/models/users/TUser';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

let cachedHubUsers: TUserAccount[] | null = null;
let cachedRoomListLength = 0;

export function useManageUsers() {
	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const route = useRoute();
	const sidebar = useSidebar();

	const hubUsers = ref<TUserAccount[]>([]);
	const selectedUserById = ref<string>();
	const selectedUserDisplayName = ref<string>();
	const showUserInRoomForm = ref(false);
	const showAskDisclosureAttrsForm = ref(false);
	const selectedUser = ref<TUserAccount | null>(null);

	const isAdmin = computed(() => user.isAdministrator);
	const currentAdministrator = computed(() => user.administrator as unknown as Administrator | null);

	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				selectedUserById.value = undefined;
			}
		},
	);

	function selectUserFromQuery(userId: string) {
		if (hubUsers.value.length === 0) return;
		const target = hubUsers.value.find((u) => u.name === userId);
		if (target) {
			selectUser(target.name, target.displayname);
		}
		router.replace({ query: {} });
	}

	watch(
		() => route.query.userId,
		(userId) => {
			if (userId && typeof userId === 'string') {
				selectUserFromQuery(userId);
			}
		},
	);

	function displayNameWithSuffix(account: TUserAccount): string {
		if (account.name === user.userId) {
			return `${account.displayname} ${t('admin.you_suffix')}`;
		}
		return account.displayname;
	}

	function asUserAccount(item: Record<string, unknown>): TUserAccount {
		return item as unknown as TUserAccount;
	}

	function openAskDisclosureForm(item: TUserAccount) {
		selectedUser.value = item;
		showAskDisclosureAttrsForm.value = true;
	}

	function openDisclosureForSelectedUser() {
		const userAccount = hubUsers.value.find((u) => u.name === selectedUserById.value);
		if (userAccount) {
			openAskDisclosureForm(userAccount);
		}
	}

	function closeAskDisclosureForm() {
		showAskDisclosureAttrsForm.value = false;
		selectedUser.value = null;
	}

	async function fetchStewardUsers(): Promise<TUserAccount[]> {
		const roomsStore = useRooms();
		await roomsStore.waitForInitialRoomsLoaded();
		const userId = user.userId;
		if (!userId) return [];

		const userMap = new Map<string, TUserAccount>();

		for (const entry of roomsStore.roomList) {
			if (DirectRooms.includes(entry.roomType as RoomType)) continue;

			const powerLevelEvent = entry.stateEvents.find((e) => e.type === EventType.RoomPowerLevels);
			if (!powerLevelEvent) continue;
			const stewardPl = powerLevelEvent.content?.users?.[userId] ?? powerLevelEvent.content?.users_default ?? 0;
			if (stewardPl < UserPowerLevel.Steward) continue;

			const myMembership = entry.stateEvents.find((e) => e.type === EventType.RoomMember && e.state_key === userId);
			if (myMembership?.content?.membership !== 'join') continue;

			const memberIds = entry.stateEvents
				.filter((e) => e.type === EventType.RoomMember && e.content?.membership === 'join')
				.map((e) => e.state_key)
				.filter((id) => !id.startsWith('@notices_user:'));

			for (const memberId of memberIds) {
				if (userMap.has(memberId)) continue;
				const displayname = user.userDisplayName(memberId) || memberId;
				userMap.set(memberId, {
					name: memberId,
					displayname,
					admin: false,
					user_type: null,
					is_guest: false,
					deactivated: false,
					shadow_banned: false,
					avatar_url: '',
					creation_ts: 0,
					approved: true,
					erased: false,
					last_seen_ts: null,
					locked: false,
				});
			}
		}

		return Array.from(userMap.values());
	}

	onMounted(async () => {
		const roomListChanged = rooms.roomList.length !== cachedRoomListLength;
		if (cachedHubUsers && !roomListChanged) {
			hubUsers.value = cachedHubUsers;
		} else {
			if (isAdmin.value) {
				await rooms.fetchPublicRooms(true);
				try {
					await rooms.fetchSecuredRooms();
				} catch {
					// Stewards can't list secured rooms via this endpoint
				}
				cachedHubUsers = await ManagementUtils.getUsersAccounts();
			} else {
				cachedHubUsers = await fetchStewardUsers();
			}
			cachedRoomListLength = rooms.roomList.length;
			hubUsers.value = cachedHubUsers;
		}
		// Handle userId query param now that hubUsers is populated
		const targetUserId = route.query.userId as string | undefined;
		if (targetUserId) {
			selectUserFromQuery(targetUserId);
		}
	});

	function selectUser(userId: string, displayName: string) {
		if (sidebar.activeTab.value === SidebarTab.ManageUser && selectedUserById.value === userId) {
			sidebar.close();
			return;
		}
		selectedUserById.value = userId;
		selectedUserDisplayName.value = displayName;
		sidebar.openTab(SidebarTab.ManageUser);
	}

	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	return {
		hubUsers,
		selectedUserById,
		selectedUserDisplayName,
		showUserInRoomForm,
		showAskDisclosureAttrsForm,
		selectedUser,
		isAdmin,
		currentAdministrator,
		displayNameWithSuffix,
		asUserAccount,
		openAskDisclosureForm,
		openDisclosureForSelectedUser,
		closeAskDisclosureForm,
		selectUser,
	};
}
