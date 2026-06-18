<template>
	<AdminMembers
		v-if="showPastMemberPanel"
		:room-id="currentRoomId"
		@close="closeForm()"
	/>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div
			class="border-on-surface-disabled/25 flex h-[80px] shrink-0 items-center justify-between border-b-2 px-400"
			:class="isMobile ? 'pl-600' : 'pl-400'"
		>
			<div class="flex w-fit items-center gap-150 overflow-hidden">
				<Icon type="chats-circle" />
				<H3 class="font-headings text-h3 text-on-surface font-semibold">
					{{ t('menu.admin_tools_rooms') }}
				</H3>
			</div>
			<div class="flex items-center gap-100" />
		</div>

		<div class="flex flex-1 overflow-hidden">
			<div
				id="manage-rooms-container"
				class="relative h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				:class="isMobile ? 'py-150' : 'py-200'"
			>
				<FilterableList
					:filter-keys="['name']"
					:items="allRoomsWithType as unknown as Array<Record<string, unknown>>"
					:chip-filters="roomTypeFilters"
					:placeholder="$t('rooms.filter')"
					:empty-text="$t('rooms.empty_rooms')"
					sortby="name"
				>
					<template #filtered="{ items }">
						<div
							class="flex flex-col gap-200"
							:class="isMobile ? 'px-150' : 'grid grid-cols-[1fr_1fr_auto_auto_auto] gap-x-0 gap-y-0'"
						>
							<div
								v-if="!isMobile"
								class="contents"
							>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('admin.name') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('admin.topic') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('admin.room_type') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('rooms.yivi_attributes') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-200 py-100 text-sm font-semibold">
									{{ t('rooms.member_count') }}
								</div>
							</div>
							<TableRow
								v-for="(item, index) in items"
								:key="itemRoomId(item)"
								:odd="index % 2 === 0"
								:selected="selectedRoomId === itemRoomId(item)"
								@click="selectRoom(itemRoomId(item), (item as any).name)"
							>
								<RoomListCard
									:room-id="itemRoomId(item)"
									:name="(item as any).name"
									:room-type="(item as any)._roomType"
									:topic="rooms.getRoomTopic(itemRoomId(item)) || (item as any).topic || ''"
									:room-type-value="(item as any).room_type"
									:user-txt="(item as any).user_txt || ''"
									:num-joined-members="(item as any).num_joined_members ?? undefined"
									:yivi-attributes="(item as any)._roomType === 'secured' ? (item as any).accepted : undefined"
								/>
							</TableRow>
						</div>
					</template>
				</FilterableList>
				<div class="absolute right-200 bottom-200 z-50">
					<FloatingActionButton
						:label="t('rooms.add_room')"
						icon="plus"
						@click="newPublicRoom"
					/>
				</div>
			</div>

			<RoomSidebar
				:active-tab="sidebar.activeTab.value"
				:is-mobile="isMobile"
			>
				<ManageRoomSidebar
					:room-id="selectedRoomId ?? ''"
					:room-name="selectedRoomName ?? ''"
					:is-room-admin="selectedRoomIsAdmin"
					:is-hub-admin="isAdmin"
					@go-to-room="goToSelectedRoom"
					@edit="editSelectedRoom"
					@remove="removeSelectedRoom"
					@promote="promoteSelectedRoom"
					@navigate-to-user="navigateToUser"
				/>
			</RoomSidebar>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AdminMembers from '@hub-client/components/rooms/AdminMembers.vue';
	import RoomListCard from '@hub-client/components/rooms/RoomListCard.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import ManageRoomSidebar from '@hub-client/components/ui/ManageRoomSidebar.vue';

	// Composables
	import { useManageRooms } from '@hub-client/composables/useManageRooms';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	// Props
	defineProps<{
		tab: string;
	}>();

	const { t } = useI18n();
	const rooms = useRooms();
	const settings = useSettings();
	const sidebar = useSidebar();

	const isMobile = computed(() => settings.isMobileState ?? false);

	const {
		showPastMemberPanel,
		currentRoomId,
		selectedRoomId,
		selectedRoomName,
		isAdmin,
		selectedRoomIsAdmin,
		allRoomsWithType,
		roomTypeFilters,
		newPublicRoom,
		editSelectedRoom,
		removeSelectedRoom,
		promoteSelectedRoom,
		goToSelectedRoom,
		navigateToUser,
		selectRoom,
		closeForm,
		itemRoomId,
	} = useManageRooms();
</script>
