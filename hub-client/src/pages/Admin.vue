<template>
	<AdminMembers v-if="showPastMemberPanel" :roomId="currentRoomId" @close="closeForm()"> </AdminMembers>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="hidden items-center gap-4 text-on-surface-dim md:flex">
				<span class="font-semibold uppercase">{{ t('admin.title_administrator') }}</span>
				<hr class="h-[2px] grow bg-on-surface-dim" />
			</div>
			<div class="flex h-full items-center" :class="isMobile ? 'pl-12' : 'pl-0'">
				<H3 class="font-headings font-semibold text-on-surface">{{ t('menu.admin_tools_rooms') }}</H3>
			</div>
		</template>
		<Tabs class="p-3 md:p-4">
			<TabHeader>
				<TabPill v-slot="slotProps">{{ $t('admin.public_rooms') }}<Icon v-if="slotProps.active" class="float-right ml-2 mt-1 hover:text-accent-primary" type="plus" size="sm" @click="newPublicRoom()" /></TabPill>
				<TabPill v-slot="slotProps">{{ $t('admin.secured_rooms') }}<Icon v-if="slotProps.active" class="float-right ml-2 mt-1 hover:text-accent-primary" type="plus" size="sm" @click="newSecuredRoom()" /></TabPill>
			</TabHeader>
			<TabContainer>
				<TabContent>
					<p v-if="nonSecuredPublicRooms.length === 0">{{ $t('admin.no_rooms') }}</p>
					<FilteredList v-else :items="nonSecuredPublicRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex w-full justify-between gap-8 overflow-hidden" :title="item.room_id">
								<div class="flex w-full items-center gap-4 overflow-hidden">
									<Icon type="chats-circle" class="shrink-0 fill-accent-lime" />
									<p class="min-w-20 truncate">{{ item.name }}</p>
									<p class="text-gray-light hidden truncate pr-1 italic md:inline">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.room_type" class="text-gray-light italic">- {{ item.room_type }} </span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex items-center gap-2">
										<span v-if="isUserRoomAdmin(user.userId, item.room_id)" class="ml-2 flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white ~text-label-small-min/label-small-max">Administrator</span>
										<span class="flex items-center">
											<Icon type="user" size="sm" class="shrink-0" />
											<p>x</p>
											<p>{{ item.num_joined_members }}</p>
										</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.userId)">
											<Icon type="user" size="sm" class="shrink-0" />
										</span>
									</div>
									<div class="flex items-center gap-1">
										<Icon type="trash" class="hover:cursor-pointer hover:text-accent-red" @click="removePublicRoom(item)" />
										<Icon type="pencil-simple" class="hover:cursor-pointer hover:text-accent-primary" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="editPublicRoom(item)" />
										<Icon v-else type="arrow-circle-up" data-testid="promote" class="hover:cursor-pointer hover:text-accent-primary" @click="makeRoomAdmin(item.room_id, user.userId)" />
									</div>
								</div>
							</div>
						</template>
					</FilteredList>
				</TabContent>

				<TabContent>
					<p v-if="!rooms.hasSecuredRooms">
						{{ $t('admin.no_secured_rooms') }}
					</p>
					<FilteredList v-else :items="sortedSecuredRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex w-full justify-between gap-8 overflow-hidden" :title="item.room_id">
								<div class="flex w-full items-center gap-4 overflow-hidden">
									<Icon type="shield" class="text-green shrink-0 group-hover:text-black" />
									<p class="min-w-20 truncate">{{ item.name }}</p>
									<p class="text-gray-light hidden truncate pr-1 italic md:inline">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.user_txt !== ''" class="text-gray-light hidden truncate italic md:inline"> [{{ item.user_txt }}]</span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex items-center gap-2">
										<span v-if="isUserRoomAdmin(user.userId, item.room_id)" class="ml-2 flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white ~text-label-small-min/label-small-max">Administrator</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.userId)">
											<Icon type="user" size="sm" class="shrink-0" />
										</span>
									</div>
									<div class="flex items-center gap-1">
										<Icon type="trash" class="hover:cursor-pointer hover:text-accent-red" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="removeSecuredRoom(item)" />
										<Icon type="pencil-simple" class="hover:cursor-pointer hover:text-accent-primary" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="EditSecuredRoom(item)" />
										<Icon v-else type="arrow-circle-up" class="hover:cursor-pointer hover:text-accent-primary" @click="makeRoomAdmin(item.room_id, user.userId)" />
									</div>
								</div>
							</div>
						</template>
					</FilteredList>
				</TabContent>
			</TabContainer>
		</Tabs>

		<template #footer>
			<EditRoomForm v-if="showEditRoom" :room="editRoom" :secured="secured" @close="closeEdit()" />
		</template>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import EditRoomForm from '@hub-client/components/rooms/EditRoomForm.vue';
	import FilteredList from '@hub-client/components/ui/FilteredList.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import TabContainer from '@hub-client/components/ui/TabContainer.vue';
	import TabContent from '@hub-client/components/ui/TabContent.vue';
	import TabHeader from '@hub-client/components/ui/TabHeader.vue';
	import TabPill from '@hub-client/components/ui/TabPill.vue';
	import Tabs from '@hub-client/components/ui/Tabs.vue';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiHubManagement';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { TPublicRoom, TSecuredRoom, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const editRoom = ref({} as TSecuredRoom | TPublicRoom);
	const secured = ref(false);
	const showEditRoom = ref(false);
	const showPastMemberPanel = ref(false);
	const currentRoomId = ref('');
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const nonSecuredPublicRooms = computed(() => rooms.nonSecuredPublicRooms);
	const sortedSecuredRooms = computed(() => rooms.sortedSecuredRooms);

	onMounted(async () => {
		await rooms.fetchPublicRooms();
		await rooms.fetchSecuredRooms();
	});

	function newPublicRoom() {
		secured.value = false;
		showEditRoom.value = true;
	}

	function newSecuredRoom() {
		secured.value = true;
		showEditRoom.value = true;
	}

	function editPublicRoom(room: TPublicRoom) {
		editRoom.value = room;
		secured.value = false;
		showEditRoom.value = true;
	}

	function EditSecuredRoom(room: TSecuredRoom) {
		editRoom.value = room;
		secured.value = true;
		showEditRoom.value = true;
	}

	function closeEdit() {
		editRoom.value = {} as TSecuredRoom;
		secured.value = false;
		showEditRoom.value = false;

		rooms.fetchPublicRooms();
		rooms.fetchSecuredRooms();
	}

	async function removePublicRoom(room: TPublicRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.remove_room_sure'))) {
			try {
				await rooms.removePublicRoom(room.room_id);
				if (secured.value) {
					// If the room was secured, we need to remove it from allowed_to_join_room table
					rooms.kickUsersFromSecuredRoom(room.room_id);
				}
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
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	function isUserRoomAdmin(userId: string, roomId: string): boolean {
		return rooms.room(roomId)?.getUserPowerLevel(userId) == 100 || false;
	}

	async function makeRoomAdmin(roomId: string, userId: string): Promise<void | Error> {
		const dialog = useDialog();
		const pubhubs = usePubhubsStore();
		const okCancelStatus = await dialog.okcancel(t('admin.make_admin'));
		// If the user presses cancel, then don't proceed!
		if (!okCancelStatus) return;

		try {
			await APIService.makeRoomAdmin(roomId, userId);
		} catch (error: any) {
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

	function closeForm() {
		showPastMemberPanel.value = false;
	}
</script>
