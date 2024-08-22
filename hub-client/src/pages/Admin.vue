<template>
	<HeaderFooter>
		<template #header>
			<div class="px-4">
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
					<FilteredList v-else :items="rooms.nonSecuredPublicRooms" filterKey="name" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<Icon type="room" class="mr-4 float-left text-green group-hover:text-black"></Icon>
							<span :title="item.room_id">
								{{ item.name }}
								<span class="italic text-gray-light">{{ rooms.getRoomTopic(item.room_id) }}</span>
								<span v-if="item.room_type" class="italic text-gray-light pr-2">- {{ item.room_type }} </span>
								<span class="text-blue-light">
									<Icon type="person" size="sm" class="inline-block mb-1"></Icon>x {{ item.num_joined_members }}
									<span v-if="rooms.room(item.room_id)?.userIsMember(user.user.userId)">
										<span class="text-green group-hover:text-white">
											<Icon type="person" size="sm" class="inline-block mb-1"></Icon>
										</span>
									</span>
								</span>
							</span>
							<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removePublicRoom(item)"></Icon>
							<Icon type="edit" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" class="float-right mr-1 cursor-pointer" @click="editPublicRoom(item)"></Icon>
						</template>
					</FilteredList>
				</TabContent>

				<TabContent>
					<p v-if="!rooms.hasSecuredRooms">{{ $t('admin.no_secured_rooms') }}</p>
					<FilteredList v-else :items="rooms.sortedSecuredRooms" filterKey="name" sortby="name" :placeholder="$t('rooms.filter')">
						<template #item="{ item }">
							<Icon type="lock" class="mr-4 float-left text-green group-hover:text-black"></Icon>
							<span :title="item.room_id">
								{{ item.name }} <span class="italic text-gray-light">{{ rooms.getRoomTopic(item.room_id) }}</span>
								<span v-if="item.user_txt !== ''" class="italic text-gray-light"> [{{ item.user_txt }}]</span>
							</span>
							<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removeSecuredRoom(item)"></Icon>
							<Icon type="edit" class="float-right mr-1 cursor-pointer hover:text-white" @click="EditSecuredRoom(item)"></Icon>
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
