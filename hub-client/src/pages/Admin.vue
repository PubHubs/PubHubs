<template>
	<HeaderFooter>
		<template #header>
			<div class="pl-20 md:p-4">
				<H1>{{ $t('admin.title') }}</H1>
				<p class="text-sm">{{ $t('admin.description') }}</p>
			</div>
		</template>
		<Tabs class="px-3">
			<TabHeader>
				<TabPill v-slot="slotProps">{{ $t('admin.public_rooms') }}<Icon v-if="slotProps.active" class="float-right hover:text-green ml-2" type="plus" @click="newPublicRoom()"></Icon></TabPill>
				<TabPill v-slot="slotProps">{{ $t('admin.secured_rooms') }}<Icon v-if="slotProps.active" class="float-right hover:text-green ml-2" type="plus" @click="newSecuredRoom()"></Icon></TabPill>
			</TabHeader>
			<TabContainer>
				<TabContent>
					<p v-if="rooms.nonSecuredPublicRooms.length === 0">{{ $t('admin.no_secured_rooms') }}</p>
					<FilteredList v-else :items="rooms.nonSecuredPublicRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex gap-8 w-full overflow-hidden justify-between" :title="item.room_id">
								<div class="flex w-full overflow-hidden gap-4 items-center">
									<Icon type="speech_bubbles" class="shrink-0 text-green group-hover:text-black"></Icon>
									<p class="truncate">{{ item.name }}</p>
									<p class="truncate hidden md:inline italic text-gray-light pr-1">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.room_type" class="italic text-gray-light">- {{ item.room_type }} </span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex gap-2 items-center">
										<span class="text-blue-light flex items-center">
											<Icon type="person" size="sm" class="shrink-0"></Icon>
											<p>x</p>
											<p>{{ item.num_joined_members }}</p>
										</span>
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.user.userId)" class="text-green group-hover:text-white">
											<Icon type="person" size="sm" class="shrink-0"></Icon>
										</span>
									</div>
									<div class="flex gap-1 items-center">
										<Icon type="remove" class="hover:fill-red" @click="removePublicRoom(item)"></Icon>
										<Icon type="edit" class="hover:stroke-hub-accent" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" @click="editPublicRoom(item)"></Icon>
									</div>
								</div>
							</div>
						</template>
					</FilteredList>
				</TabContent>

				<TabContent>
					<p v-if="!rooms.hasSecuredRooms">{{ $t('admin.no_secured_rooms') }}</p>
					<FilteredList v-else :items="rooms.sortedSecuredRooms" :filterKey="['name']" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<div class="flex gap-8 w-full overflow-hidden justify-between" :title="item.room_id">
								<div class="flex w-full overflow-hidden gap-4 items-center">
									<Icon type="shield" class="shrink-0 text-green group-hover:text-black"></Icon>
									<p class="truncate">{{ item.name }}</p>
									<p class="truncate hidden md:inline italic text-gray-light pr-1">{{ rooms.getRoomTopic(item.room_id) }}</p>
									<span v-if="item.user_txt !== ''" class="truncate hidden md:inline italic text-gray-light"> [{{ item.user_txt }}]</span>
								</div>
								<div class="flex w-fit gap-4">
									<div class="flex gap-2 items-center">
										<span v-if="rooms.room(item.room_id)?.userIsMember(user.user.userId)" class="text-green group-hover:text-white">
											<Icon type="person" size="sm" class="shrink-0"></Icon>
										</span>
									</div>
									<div class="flex gap-1 items-center">
										<Icon type="remove" class="cursor-pointer hover:text-red" @click="removeSecuredRoom(item)"></Icon>
										<Icon type="edit" class="cursor-pointer hover:text-white" @click="EditSecuredRoom(item)"></Icon>
									</div>
								</div>
							</div>
						</template>
					</FilteredList>
				</TabContent>
			</TabContainer>
		</Tabs>
		<template #footer>
			<EditRoomForm v-if="showEditRoom" :room="editRoom" :secured="secured" @close="closeEdit()"></EditRoomForm>
		</template>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useUser, TPublicRoom, TSecuredRoom, useRooms, useDialog } from '@/store/store';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const editRoom = ref({} as TSecuredRoom | TPublicRoom);
	const secured = ref(false);
	const showEditRoom = ref(false);

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
</script>
