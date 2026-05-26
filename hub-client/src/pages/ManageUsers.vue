<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div
			class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b px-8"
			:class="isMobile ? 'pl-12' : 'pl-8'"
		>
			<div class="flex w-fit items-center gap-3 overflow-hidden">
				<Icon type="users" />
				<H3 class="font-headings text-h3 text-on-surface font-semibold">
					{{ t('menu.admin_tools_users') }}
				</H3>
			</div>
			<div class="flex items-center gap-2">
				<GlobalBarButton
					type="user"
					:selected="sidebar.activeTab.value === SidebarTab.ManageUser"
					:title="t('admin.user_details')"
					@click="sidebar.toggleTab(SidebarTab.ManageUser)"
				/>
			</div>
		</div>

		<div class="flex flex-1 overflow-hidden">
			<div
				id="manage-users-container"
				class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				:class="isMobile ? 'py-3' : 'py-4'"
			>
				<FilterableList
					:filter-keys="['displayname', 'name']"
					:items="hubUsers as unknown as Array<Record<string, unknown>>"
					:chip-filters="[{ label: t('rooms.admin_badge'), predicate: (item) => asUserAccount(item).admin }]"
					:placeholder="$t('others.search_users')"
					:empty-text="$t('others.empty_users')"
					sortby="displayname"
				>
					<template #filtered="{ items }">
						<div
							class="flex flex-col gap-4"
							:class="isMobile ? 'px-3' : 'grid grid-cols-[1fr_1fr_auto] gap-x-0 gap-y-0'"
						>
							<div
								v-if="!isMobile"
								class="contents"
							>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('admin.name') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('others.userId') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('rooms.admin_badge') }}
								</div>
							</div>
							<TableRow
								v-for="(item, idx) in items"
								:key="asUserAccount(item).name"
								:odd="idx % 2 === 0"
								:selected="selectedUserById === asUserAccount(item).name"
								@click="selectUser(asUserAccount(item).name, asUserAccount(item).displayname)"
							>
								<UserListCard
									:user-id="asUserAccount(item).name"
									:display-name="asUserAccount(item).displayname"
									:avatar-url="user.userAvatar(asUserAccount(item).name)"
									:is-admin="asUserAccount(item).admin"
								/>
							</TableRow>
						</div>
					</template>
				</FilterableList>
				<DisclosureRequestForm
					v-if="showAskDisclosureAttrsForm && selectedUser"
					:user="selectedUser"
					@close="closeAskDisclosureForm"
				/>
			</div>
			<RoomSidebar
				:active-tab="sidebar.activeTab.value"
				:is-mobile="isMobile"
			>
				<ManageUserSidebar
					:user-id="selectedUserById ?? ''"
					:display-name="selectedUserDisplayName ?? ''"
					:administrator="currentAdministrator"
					:is-admin="isAdmin"
					@edit="currentAdministrator ? (showUserInRoomForm = true) : undefined"
					@disclose="openDisclosureForSelectedUser"
				/>
			</RoomSidebar>
		</div>
	</div>

	<UserInRoomsForm
		v-if="showUserInRoomForm && selectedUserById && currentAdministrator"
		:administrator="currentAdministrator"
		:display-name="selectedUserDisplayName!"
		:user-id="selectedUserById"
		@close="showUserInRoomForm = false"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave } from 'vue-router';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserInRoomsForm from '@hub-client/components/forms/UserInRoomsForm.vue';
	import DisclosureRequestForm from '@hub-client/components/rooms/DisclosureRequestForm.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import UserListCard from '@hub-client/components/rooms/UserListCard.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import ManageUserSidebar from '@hub-client/components/ui/ManageUserSidebar.vue';

	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import { type Administrator } from '@hub-client/models/hubmanagement/models/admin';
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
	import { type TUserAccount, UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const user = useUser();

	const hubUsers = ref<TUserAccount[]>([]);
	const selectedUserById = ref<string>();
	const selectedUserDisplayName = ref<string>();
	const sidebar = useSidebar();
	const showUserInRoomForm = ref(false);
	const showAskDisclosureAttrsForm = ref(false);

	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				selectedUserById.value = undefined;
			}
		},
	);
	const selectedUser = ref<TUserAccount | null>(null);

	const isAdmin = computed(() => user.isAdministrator);
	const currentAdministrator = user.administrator as unknown as Administrator | null;

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
		const ph = usePubhubsStore();
		const userId = user.userId;
		if (!userId) return [];

		const userMap = new Map<string, TUserAccount>();

		for (const entry of roomsStore.roomList) {
			let powerLevels: { users?: Record<string, number>; users_default?: number };
			try {
				powerLevels = await ph.getPowerLevelEventContent(entry.roomId);
			} catch {
				continue;
			}
			const stewardPl = powerLevels.users?.[userId] ?? powerLevels.users_default ?? 0;
			if (stewardPl < UserPowerLevel.Steward) continue;

			const room = roomsStore.room(entry.roomId);
			if (!room) continue;

			const memberIds = room.getStateJoinedMembersIds();
			for (const memberId of memberIds) {
				const memberPl = powerLevels.users?.[memberId] ?? 0;
				if (userMap.has(memberId)) {
					if (!userMap.get(memberId)!.admin && memberPl === UserPowerLevel.Admin) {
						userMap.get(memberId)!.admin = true;
					}
					continue;
				}
				const displayname = user.userDisplayName(memberId) || memberId;
				userMap.set(memberId, {
					name: memberId,
					displayname,
					admin: memberPl === UserPowerLevel.Admin,
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
		if (isAdmin.value) {
			hubUsers.value = await ManagementUtils.getUsersAccounts();
		} else {
			hubUsers.value = await fetchStewardUsers();
		}
	});

	async function selectUser(userId: string, displayName: string) {
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
</script>
