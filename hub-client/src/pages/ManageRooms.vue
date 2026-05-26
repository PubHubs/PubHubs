<template>
	<AdminMembers
		v-if="showPastMemberPanel"
		:room-id="currentRoomId"
		@close="closeForm()"
	/>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<div
			class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b px-8"
			:class="isMobile ? 'pl-12' : 'pl-8'"
		>
			<div class="flex w-fit items-center gap-3 overflow-hidden">
				<Icon type="chats-circle" />
				<H3 class="font-headings text-h3 text-on-surface font-semibold">
					{{ t('menu.admin_tools_rooms') }}
				</H3>
			</div>
			<div class="flex items-center gap-2">
				<GlobalBarButton
					type="pencil-simple"
					:selected="sidebar.activeTab.value === SidebarTab.ManageRoom"
					:title="t('admin.room_details')"
					@click="sidebar.toggleTab(SidebarTab.ManageRoom)"
				/>
			</div>
		</div>

		<div class="flex flex-1 overflow-hidden">
			<div
				id="manage-rooms-container"
				class="h-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto"
				:class="isMobile ? 'py-3' : 'py-4'"
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
							class="flex flex-col gap-4"
							:class="isMobile ? 'px-3' : 'grid grid-cols-[1fr_1fr_auto_auto_auto] gap-x-0 gap-y-0'"
						>
							<div
								v-if="!isMobile"
								class="contents"
							>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('admin.name') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('admin.topic') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('admin.room_type') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
									{{ t('rooms.yivi_attributes') }}
								</div>
								<div class="text-on-surface-dim border-surface-base border-b px-4 py-2 text-sm font-semibold">
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
									:topic="rooms.getRoomTopic(itemRoomId(item))"
									:room-type-value="(item as any).room_type"
									:user-txt="(item as any)._roomType !== 'public' ? (item as any).user_txt : undefined"
									:num-joined-members="(item as any)._roomType === 'public' ? (item as any).num_joined_members : undefined"
									:yivi-attributes="(item as any)._roomType === 'secured' ? (item as any).accepted : undefined"
								/>
							</TableRow>
						</div>
					</template>
				</FilterableList>
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
					@edit="editSelectedRoom"
					@remove="removeSelectedRoom"
					@promote="promoteSelectedRoom"
				/>
			</RoomSidebar>
		</div>
	</div>
	<FloatingActionButton
		:label="t('rooms.add_room')"
		icon="plus"
		@click="newPublicRoom"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave } from 'vue-router';

	// Components
	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AdminMembers from '@hub-client/components/rooms/AdminMembers.vue';
	import RoomListCard from '@hub-client/components/rooms/RoomListCard.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import TableRow from '@hub-client/components/rooms/TableRow.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import ManageRoomSidebar from '@hub-client/components/ui/ManageRoomSidebar.vue';

	import { useRoles } from '@hub-client/composables/roles.composable';
	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiHubManagement';
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
	import { DirectRooms, type RoomType, type TBaseRoom } from '@hub-client/models/rooms/TBaseRoom';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { type TPublicRoom, type TSecuredRoom, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Props
	defineProps<{
		tab: string;
	}>();

	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const pubhubs = usePubhubsStore();
	const showPastMemberPanel = ref(false);
	const currentRoomId = ref('');
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState ?? false);

	const roles = useRoles();

	const isAdmin = computed(() => user.isAdministrator);

	const sidebar = useSidebar();
	const selectedRoomId = ref<string>();
	const selectedRoomName = ref<string>();

	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab === SidebarTab.None) {
				selectedRoomId.value = undefined;
			}
		},
	);

	const selectedRoomIsAdmin = computed(() => {
		if (!selectedRoomId.value) return false;
		return roles.userIsStewardOrHigher(selectedRoomId.value);
	});

	function getUserRoomPowerLevel(roomId: string): number {
		const room = rooms.room(roomId);
		if (room) {
			return room.getStateMemberPowerLevel(user.userId);
		}
		// Fallback to roomList state events (rooms from sliding sync)
		const listEntry = rooms.roomList.find((r) => r.roomId === roomId);
		if (listEntry?.stateEvents && user.userId) {
			const event = listEntry.stateEvents.find((e) => e.type === 'm.room.power_levels' && e.content?.users);
			if (event) {
				return event.content.users[user.userId] ?? event.content.users_default ?? 0;
			}
		}
		return 0;
	}

	const nonSecuredPublicRooms = computed(() => rooms.nonSecuredPublicRooms);
	const sortedSecuredRooms = computed(() => rooms.sortedSecuredRooms);

	const allRoomsWithType = computed(() => {
		const publicRooms = nonSecuredPublicRooms.value.map((r) => ({ ...r, _roomType: 'public' }));
		const securedRooms = sortedSecuredRooms.value.map((r) => ({ ...r, _roomType: 'secured' }));
		const allRooms = [...publicRooms, ...securedRooms];
		if (isAdmin.value) return allRooms;

		// Also include rooms from the joined room list that aren't in the directory/API
		for (const entry of rooms.roomList) {
			if (DirectRooms.includes(entry.roomType as RoomType)) continue;
			if (!allRooms.some((r) => r.room_id === entry.roomId)) {
				allRooms.push({
					room_id: entry.roomId,
					name: entry.name,
					room_type: entry.roomType,
					_roomType: entry.roomType === 'ph.messages.restricted' ? 'secured' : 'public',
				} as TBaseRoom & { _roomType: string });
			}
		}
		// Filter to rooms where the user has steward+ level
		return allRooms.filter((r) => getUserRoomPowerLevel(r.room_id) >= UserPowerLevel.Steward);
	});

	const roomTypeFilters = computed(() => [
		{ label: t('admin.public_rooms'), predicate: (item: Record<string, unknown>) => (item as { _roomType?: string })._roomType === 'public' },
		{ label: t('admin.secured_rooms'), predicate: (item: Record<string, unknown>) => (item as { _roomType?: string })._roomType === 'secured' },
	]);

	onMounted(async () => {
		await rooms.fetchPublicRooms(true);
		try {
			await rooms.fetchSecuredRooms();
		} catch {
			// Stewards can't list secured rooms via this endpoint; use roomList instead
		}
	});

	function newPublicRoom() {
		router.push({ name: 'editroom', params: { id: 'new_room' } });
	}

	async function removePublicRoom(room: TPublicRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.remove_room_sure'))) {
			try {
				await rooms.removePublicRoom(room.room_id);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function removeSecuredRoom(room: TSecuredRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.secured_remove_sure'))) {
			try {
				await rooms.removeSecuredRoom(room);
				// If the room was secured, we need to remove the members from the allowed_to_join_room table
				rooms.kickUsersFromSecuredRoom(room.room_id);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function makeRoomAdmin(roomId: string, userId: string): Promise<void | Error> {
		const dialog = useDialog();
		// If the user presses cancel, then don't proceed!
		const okCancelStatus = await dialog.okcancel(t('admin.make_admin'));
		if (!okCancelStatus) return;

		try {
			await APIService.makeRoomAdmin(roomId, userId);
		} catch {
			const roomCreator = await ManagementUtils.getRoomCreator(roomId);
			if (roomCreator === user.userId) {
				await pubhubs.joinRoom(roomId);
				return;
			}

			// This will happen in case of abandon room i.e., rooms without room admin.
			const isMember = await ManagementUtils.roomCreatorIsMember(roomId);
			// Creator is not a member of the room, so we show past admin to join.
			if (!isMember) {
				showPastMemberPanel.value = true;
				currentRoomId.value = roomId;
				return;
			}
		}
		await pubhubs.joinRoom(roomId);
	}

	function itemRoomId(item: Record<string, unknown>): string {
		return (item.room_id as string) ?? '';
	}

	function closeForm() {
		showPastMemberPanel.value = false;
	}

	function findSelectedRoom(): TPublicRoom | TSecuredRoom | undefined {
		const publicRoom = nonSecuredPublicRooms.value.find((r) => r.room_id === selectedRoomId.value);
		if (publicRoom) return publicRoom;
		return sortedSecuredRooms.value.find((r) => r.room_id === selectedRoomId.value);
	}

	function editSelectedRoom() {
		if (!selectedRoomId.value) return;
		router.push({ name: 'editroom', params: { id: selectedRoomId.value } });
	}

	function removeSelectedRoom() {
		const room = findSelectedRoom();
		if (!room) return;
		if (nonSecuredPublicRooms.value.find((r) => r.room_id === selectedRoomId.value)) {
			removePublicRoom(room as TPublicRoom);
		} else {
			removeSecuredRoom(room as TSecuredRoom);
		}
	}

	function promoteSelectedRoom() {
		if (selectedRoomId.value) {
			makeRoomAdmin(selectedRoomId.value, user.userId ?? '');
		}
	}

	function selectRoom(roomId: string, roomName: string) {
		if (sidebar.activeTab.value === SidebarTab.ManageRoom && selectedRoomId.value === roomId) {
			sidebar.close();
			return;
		}
		selectedRoomId.value = roomId;
		selectedRoomName.value = roomName;
		sidebar.openTab(SidebarTab.ManageRoom);
	}

	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});
</script>
