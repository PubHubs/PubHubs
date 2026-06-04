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
			<div class="flex items-center gap-2" />
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
									:display-name="displayNameWithSuffix(asUserAccount(item))"
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
					@navigate-to-room="navigateToRoom"
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
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import UserInRoomsForm from '@hub-client/components/forms/UserInRoomsForm.vue';
	import DisclosureRequestForm from '@hub-client/components/rooms/DisclosureRequestForm.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import UserListCard from '@hub-client/components/rooms/UserListCard.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import ManageUserSidebar from '@hub-client/components/ui/ManageUserSidebar.vue';

	// Composables
	import { useManageUsers } from '@hub-client/composables/useManageUsers';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const user = useUser();
	const sidebar = useSidebar();

	const {
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
		openDisclosureForSelectedUser,
		closeAskDisclosureForm,
		navigateToRoom,
		selectUser,
	} = useManageUsers();
</script>
