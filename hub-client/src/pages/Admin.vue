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
					<p v-if="rooms.nonSecuredPublicRooms.length === 0">{{ $t('admin.no_rooms') }}</p>
					<FilteredList v-else :items="rooms.nonSecuredPublicRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex w-full justify-between gap-8 overflow-hidden" :title="item.room_id">
								<div class="flex w-full items-center gap-4 overflow-hidden">
									<Icon type="speech_bubbles" class="shrink-0 fill-accent-lime" />
									<p class="min-w-20 truncate">{{ item.name }}</p>
									<p class="text-gray-light hidden truncate pr-1 italic md:inline">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.room_type" class="text-gray-light italic">- {{ item.room_type }} </span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex items-center gap-2">
										<span v-if="isUserRoomAdmin(user.user.userId, item.room_id)" class="relative line-clamp-1 items-center rounded-md bg-accent-red px-1 font-medium text-on-accent-red ~text-label-min/label-max"
											>Administrator</span
										>
										<span class="flex items-center">
											<Icon type="person" size="sm" class="shrink-0" />
											<p>x</p>
											<p>{{ item.num_joined_members }}</p>
										</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.user.userId)">
											<Icon type="person" size="sm" class="shrink-0" />
										</span>
									</div>
									<div class="flex items-center gap-1">
										<Icon type="remove" class="hover:cursor-pointer hover:text-accent-red" @click="removePublicRoom(item)" />
										<Icon type="edit" class="hover:cursor-pointer hover:text-accent-primary" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" @click="editPublicRoom(item)" />
										<Icon v-else type="promote" class="hover:cursor-pointer hover:text-accent-primary" @click="makeRoomAdmin(item.room_id, user.user.userId)" />
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
					<FilteredList v-else :items="rooms.sortedSecuredRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
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
										<span v-if="isUserRoomAdmin(user.user.userId, item.room_id)" class="relative items-center rounded-md bg-accent-red px-1 font-medium text-white ~text-label-min/label-max">Administrator</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.user.userId)">
											<Icon type="person" size="sm" class="shrink-0" />
										</span>
									</div>
									<div class="flex items-center gap-1">
										<Icon type="remove" class="hover:cursor-pointer hover:text-accent-red" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" @click="removeSecuredRoom(item)" />
										<Icon type="edit" class="hover:cursor-pointer hover:text-accent-primary" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" @click="EditSecuredRoom(item)" />
										<Icon type="promote" class="hover:cursor-pointer hover:text-accent-primary" @click="makeRoomAdmin(item.room_id, user.user.userId)" />
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
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { APIService } from '@/logic/core/apiHubManagement';
	import { ManagementUtils } from '@/model/hubmanagement/utility/managementutils';
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import Tabs from '@/components/ui/Tabs.vue';
	import TabHeader from '@/components/ui/TabHeader.vue';
	import TabPill from '@/components/ui/TabPill.vue';
	import TabContainer from '@/components/ui/TabContainer.vue';
	import TabContent from '@/components/ui/TabContent.vue';
	import FilteredList from '@/components/ui/FilteredList.vue';
	import Icon from '@/components/elements/Icon.vue';
	import EditRoomForm from '@/components/rooms/EditRoomForm.vue';
	import H3 from '@/components/elements/H3.vue';

	import { useDialog } from '@/logic/store/dialog';
	import { TPublicRoom, TSecuredRoom, useRooms } from '@/logic/store/rooms';
	import { useUser } from '@/logic/store/user';
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useSettings } from '@/logic/store/settings';

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
		const pubhubs = usePubHubs();
		const okCancelStatus = await dialog.okcancel(t('admin.make_admin'));
		// If the user presses cancel, then don't proceed!
		if (!okCancelStatus) return;
		try {
			await APIService.makeRoomAdmin(roomId, userId);
		} catch (error: any) {
			const isMember = await ManagementUtils.roomCreatorIsMember(roomId);
			// Creator is not a member of the room, so we show past admin to join.
			if (!isMember) {
				showPastMemberPanel.value = true;
				currentRoomId.value = roomId;
			} else {
				// if creator is a member, but error was thrown, then some other issue has occured.
				throw error;
			}
		}
		await pubhubs.joinRoom(roomId);
	}

	function closeForm() {
		showPastMemberPanel.value = false;
	}
</script>
