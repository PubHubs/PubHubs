<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div
			class="border-on-surface-disabled/25 flex h-1000 shrink-0 items-center justify-between border-b-2 px-400"
			:class="isMobile ? 'pl-600' : 'pl-400'"
		>
			<div class="flex w-fit items-center gap-150 overflow-hidden">
				<Icon type="user-circle-check" />
				<H3 class="font-headings text-h3 text-on-surface font-semibold">
					{{ t('menu.admin_tools_roles') }}
				</H3>
			</div>
			<div class="flex items-center gap-100">
				<Button
					variant="secondary"
					size="sm"
					icon="arrows-clockwise"
					:disabled="isLoading"
					@click="fetchRoles"
				>
					{{ t('roles.refresh') }}
				</Button>
			</div>
		</div>

		<div class="flex flex-1 overflow-hidden">
			<div
				id="manage-roles-container"
				class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				:class="isMobile ? 'py-150' : 'py-200'"
			>
				<FilterableList
					:filter-keys="['displayName', 'roomName', 'userId']"
					:items="roleEntries as unknown as Array<Record<string, unknown>>"
					:chip-filters="chipFilters"
					:placeholder="t('roles.search')"
					:empty-text="t('roles.empty')"
					sortby="displayName"
				>
					<template #filtered="{ items }">
						<div
							class="flex flex-col gap-200"
							:class="isMobile ? 'px-150' : 'grid grid-cols-[1fr_1fr_auto_auto] gap-x-0 gap-y-0'"
						>
							<div
								v-if="!isMobile"
								class="contents"
							>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('admin.name') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('roles.room') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('roles.type') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('roles.status') }}
								</div>
							</div>
							<TableRow
								v-for="(item, idx) in items"
								:key="asRoleEntry(item).id"
								:odd="idx % 2 === 0"
								:selected="selectedRoleId === asRoleEntry(item).id"
								@click="handleSelectRole(asRoleEntry(item))"
							>
								<RoleListCard
									:user-id="asRoleEntry(item).userId"
									:display-name="asRoleEntry(item).displayName"
									:room-name="asRoleEntry(item).roomName"
									:avatar-url="user.userAvatar(asRoleEntry(item).userId)"
									:type="asRoleEntry(item).type"
									:status="asRoleEntry(item).status"
								/>
							</TableRow>
						</div>
					</template>
				</FilterableList>
				<!-- Load more button -->
				<div
					v-if="hasMoreToLoad"
					class="flex justify-center py-200"
				>
					<Button
						variant="secondary"
						size="sm"
						:disabled="isLoadingMore"
						@click="loadMoreInvitations"
					>
						{{ isLoadingMore ? t('roles.loading_more') : t('roles.load_more') }}
					</Button>
				</div>
				<div class="absolute right-200 bottom-200 z-50">
					<FloatingActionButton
						:label="t('roles.new_invitation')"
						icon="plus"
						@click="showDisclosureForm = true"
					/>
				</div>
				<DisclosureRequestForm
					v-if="showDisclosureForm"
					:user="emptyUser"
					@close="handleDisclosureFormClose"
				/>
			</div>
			<RoomSidebar
				:active-tab="sidebar.activeTab.value"
				:is-mobile="isMobile"
			>
				<ManageRoleSidebar
					v-if="selectedRole"
					:role="selectedRole"
					@promote-steward="handlePromoteSteward"
					@promote-expert="handlePromoteExpert"
					@reject="handleReject"
					@demote="handleDemote"
					@remove-expert="handleRemoveExpert"
				/>
				<div
					v-else
					class="flex h-full flex-col py-200"
				>
					<SidebarHeader :title="t('roles.details')" />
					<div class="flex h-full items-center justify-center px-200">
						<p class="text-on-surface-dim text-center italic">
							{{ t('roles.select_placeholder') }}
						</p>
					</div>
				</div>
			</RoomSidebar>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave } from 'vue-router';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import DisclosureRequestForm from '@hub-client/components/rooms/DisclosureRequestForm.vue';
	import RoleListCard from '@hub-client/components/rooms/RoleListCard.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import ManageRoleSidebar from '@hub-client/components/ui/ManageRoleSidebar.vue';
	import SidebarHeader from '@hub-client/components/ui/SidebarHeader.vue';

	// Composables
	import { type TRoleEntry, useManageRoles } from '@hub-client/composables/manage-roles.composable';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import { type TUserAccount } from '@hub-client/models/users/TUser';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const settings = useSettings();
	const sidebar = useSidebar();
	const user = useUser();
	const dialog = useDialog();

	const isMobile = computed(() => settings.isMobileState);
	const showDisclosureForm = ref(false);
	const emptyUser: TUserAccount = {
		name: '',
		displayname: '',
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
	};

	const {
		roleEntries,
		selectedRoleId,
		selectedRole,
		isLoading,
		isLoadingMore,
		hasMoreToLoad,
		fetchRoles,
		loadMoreInvitations,
		selectRole,
		promoteToSteward,
		promoteToExpert,
		rejectInvitation,
		demoteSteward,
		removeExpert,
	} = useManageRoles();

	const chipFilters = computed(() => [
		{
			label: t('roles.filter_invitations'),
			predicate: (item: Record<string, unknown>) => asRoleEntry(item).type.includes('invitation'),
		},
		{
			label: t('roles.filter_stewards'),
			predicate: (item: Record<string, unknown>) => asRoleEntry(item).type === 'active-steward' || asRoleEntry(item).type === 'steward-invitation',
		},
		{
			label: t('roles.filter_experts'),
			predicate: (item: Record<string, unknown>) => asRoleEntry(item).type === 'active-expert' || asRoleEntry(item).type === 'expert-invitation',
		},
	]);

	const asRoleEntry = (item: Record<string, unknown>): TRoleEntry => item as unknown as TRoleEntry;

	const handleSelectRole = (entry: TRoleEntry) => {
		if (sidebar.activeTab.value === SidebarTab.ManageUser && selectedRoleId.value === entry.id) {
			sidebar.close();
			return;
		}
		selectRole(entry);
	};

	const handlePromoteSteward = async () => {
		if (!selectedRole.value) return;
		if (await dialog.okcancel(t('roles.promote_steward_confirm', { name: selectedRole.value.displayName }))) {
			await promoteToSteward(selectedRole.value);
		}
	};

	const handlePromoteExpert = async () => {
		if (!selectedRole.value) return;
		if (await dialog.okcancel(t('roles.promote_expert_confirm', { name: selectedRole.value.displayName }))) {
			await promoteToExpert(selectedRole.value);
		}
	};

	const handleReject = async () => {
		if (!selectedRole.value) return;
		if (await dialog.okcancel(t('roles.reject_confirm', { name: selectedRole.value.displayName }))) {
			await rejectInvitation(selectedRole.value);
		}
	};

	const handleDemote = async () => {
		if (!selectedRole.value) return;
		if (await dialog.okcancel(t('roles.demote_confirm', { name: selectedRole.value.displayName }))) {
			await demoteSteward(selectedRole.value);
		}
	};

	const handleRemoveExpert = async () => {
		if (!selectedRole.value) return;
		if (await dialog.okcancel(t('roles.remove_expert_confirm', { name: selectedRole.value.displayName }))) {
			await removeExpert(selectedRole.value);
		}
	};

	const handleDisclosureFormClose = () => {
		showDisclosureForm.value = false;
		fetchRoles();
	};

	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});
</script>
