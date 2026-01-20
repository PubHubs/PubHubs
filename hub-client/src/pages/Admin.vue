<template>
	<AdminMembers v-if="showPastMemberPanel" :roomId="currentRoomId" @close="closeForm()"> </AdminMembers>
	<HeaderFooter bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="text-on-surface-dim hidden items-center gap-4 md:flex">
				<span class="font-semibold uppercase">{{ t('admin.title_administrator') }}</span>
				<hr class="bg-on-surface-dim h-[2px] grow" />
			</div>
			<div class="flex h-full items-center" :class="isMobile ? 'pl-12' : 'pl-0'">
				<H3 class="font-headings text-on-surface font-semibold">{{ t('menu.admin_tools_rooms') }}</H3>
			</div>
		</template>
		<Tabs class="p-3 md:p-4" :open-tab="tab ? tab : 1">
			<TabHeader>
				<TabPill v-slot="slotProps" @click.stop="updateTabInUrl(1)">{{ $t('admin.public_rooms') }}<Icon v-if="slotProps.active" class="hover:text-accent-primary ml-2" type="plus" size="sm" @click.stop="newPublicRoom()" /></TabPill>
				<TabPill v-slot="slotProps" @click.stop="updateTabInUrl(2)"
					>{{ $t('admin.secured_rooms') }}<Icon v-if="slotProps.active" class="hover:text-accent-primary ml-2" type="plus" size="sm" @click.stop="newSecuredRoom()"
				/></TabPill>
			</TabHeader>
			<TabContainer>
				<TabContent>
					<p v-if="nonSecuredPublicRooms.length === 0">{{ $t('admin.no_rooms') }}</p>
					<FilteredList v-else :items="nonSecuredPublicRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex w-full justify-between gap-8 overflow-hidden" :title="item.room_id">
								<div class="flex w-full items-center gap-4 overflow-hidden">
									<Icon type="chats-circle" class="fill-accent-lime shrink-0" />
									<p class="min-w-20 truncate">{{ item.name }}</p>
									<p class="text-gray-light hidden truncate pr-1 italic md:inline">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.room_type" class="text-gray-light italic">- {{ item.room_type }} </span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex items-center gap-2">
										<span v-if="isUserRoomAdmin(user.userId, item.room_id)" class="text-label-small ml-2 flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white">Administrator</span>
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
										<Icon type="trash" class="hover:text-accent-red hover:cursor-pointer" @click="removePublicRoom(item)" />
										<Icon type="pencil-simple" class="hover:text-accent-primary hover:cursor-pointer" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="editPublicRoom(item)" />
										<Icon v-else type="arrow-circle-up" data-testid="promote" class="hover:text-accent-primary hover:cursor-pointer" @click="makeRoomAdmin(item.room_id, user.userId)" />
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
										<span v-if="isUserRoomAdmin(user.userId, item.room_id)" class="text-label-small ml-2 flex h-4 items-center gap-1 rounded-xl bg-black px-2 text-white">Administrator</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.userId)">
											<Icon type="user" size="sm" class="shrink-0" />
										</span>
									</div>
									<div class="flex items-center gap-1">
										<Icon type="trash" class="hover:text-accent-red hover:cursor-pointer" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="removeSecuredRoom(item)" />
										<Icon type="pencil-simple" class="hover:text-accent-primary hover:cursor-pointer" v-if="rooms.room(item.room_id)?.userCanChangeName(user.userId)" @click="EditSecuredRoom(item)" />
										<Icon v-else type="arrow-circle-up" class="hover:text-accent-primary hover:cursor-pointer" @click="makeRoomAdmin(item.room_id, user.userId)" />
									</div>
								</div>
							</div>
						</template>
					</FilteredList>
				</TabContent>
			</TabContainer>
		</Tabs>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import FilteredList from '@hub-client/components/ui/FilteredList.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import TabContainer from '@hub-client/components/ui/TabContainer.vue';
	import TabContent from '@hub-client/components/ui/TabContent.vue';
	import TabHeader from '@hub-client/components/ui/TabHeader.vue';
	import TabPill from '@hub-client/components/ui/TabPill.vue';
	import Tabs from '@hub-client/components/ui/Tabs.vue';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiHubManagement';
	import { router } from '@hub-client/logic/core/router';

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
	const secured = ref(false);
	const showPastMemberPanel = ref(false);
	const currentRoomId = ref('');
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const nonSecuredPublicRooms = computed(() => rooms.nonSecuredPublicRooms);
	const sortedSecuredRooms = computed(() => rooms.sortedSecuredRooms);

	// Passed by the router
	const props = defineProps({ tab: String });

	onMounted(async () => {
		await rooms.fetchPublicRooms(true);
		await rooms.fetchSecuredRooms();
	});

	function newPublicRoom() {
		router.push({ name: 'editroom', params: { id: 'new_room' } });
	}

	function newSecuredRoom() {
		router.push({ name: 'editroom', params: { id: 'new_secured_room' } });
	}

	function editPublicRoom(room: TPublicRoom) {
		router.push({ name: 'editroom', params: { id: room.room_id } });
	}

	function EditSecuredRoom(room: TSecuredRoom) {
		router.push({ name: 'editroom', params: { id: room.room_id } });
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

	function updateTabInUrl(tab: number) {
		router.replace({ name: 'admin', params: { tab: tab } });
	}

	function closeForm() {
		showPastMemberPanel.value = false;
	}
</script>
