<template>
	<div class="flex flex-col h-screen">
		<div class="h-20 pt-4 px-4 z-10">
			<H1 class="mt-4">{{ $t('admin.title') }}</H1>
			<p class="text-sm">{{ $t('admin.description') }}</p>
		</div>
		<Line class="m-4 mb-4"></Line>
		<div class="px-4">
			<Tabs>
				<TabHeader>
					<TabPill v-slot="slotProps">Public Rooms<Icon v-if="slotProps.active" class="float-right hover:text-green ml-2" type="plus" @click="newPublicRoom()"></Icon></TabPill>
					<TabPill v-slot="slotProps">Secured Rooms<Icon v-if="slotProps.active" class="float-right hover:text-green ml-2" type="plus" @click="newSecuredRoom()"></Icon></TabPill>
				</TabHeader>
				<TabContainer>
					<TabContent>
						<p v-if="rooms.nonSecuredPublicRooms.length == 0">{{ $t('admin.no_secured_rooms') }}</p>
						<FilteredList v-else :items="rooms.nonSecuredPublicRooms" filterKey="name" :placeholder="$t('rooms.filter')">
							<template #item="{ item }">
								<Icon type="room" class="mr-4 float-left text-green group-hover:text-black"></Icon>
								<span :title="item.room_id">
									{{ item.name }}
									<span v-if="item.room_type" class="italic text-gray-light pr-2"> {{ item.room_type }} </span>
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
								<Icon type="edit" v-if="rooms.room(item.room_id)?.userCanChangeName(user.user.userId)" class="float-right mr-1 cursor-pointer" @click="renamePublicRoom(item)"></Icon>
							</template>
						</FilteredList>
					</TabContent>

					<TabContent>
						<p v-if="!rooms.hasSecuredRooms">{{ $t('admin.no_secured_rooms') }}</p>
						<FilteredList v-else :items="rooms.sortedSecuredRooms" filterKey="room_name" :placeholder="$t('rooms.filter')">
							<template #item="{ item }">
								<Icon type="lock" class="mr-4 float-left text-green group-hover:text-black"></Icon>
								<span :title="item.room_id">
									{{ item.room_name }} <span v-if="item.user_txt !== ''" class="italic text-gray-light">- {{ item.user_txt }}</span>
								</span>
								<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removeSecuredRoom(item)"></Icon>
								<Icon type="edit" class="float-right mr-1 cursor-pointer hover:text-white" @click="EditSecuredRoom(item)"></Icon>
							</template>
						</FilteredList>
					</TabContent>
				</TabContainer>
			</Tabs>
		</div>
	</div>
	<EditRoomName v-if="showEditName" :room="editRoomName" @close="closeRename()"></EditRoomName>
	<EditRoomForm v-if="showEditRoom" :room="editRoom" :secured="secured" @close="closeEdit()"></EditRoomForm>
</template>

<script setup lang="ts">
	import { ref, onMounted } from 'vue';
	import { useUser, PublicRoom, SecuredRoom, useRooms, useDialog } from '@/store/store';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const user = useUser();
	const rooms = useRooms();
	const editRoomName = ref({} as PublicRoom);
	const editRoom = ref({} as SecuredRoom | PublicRoom);
	const secured = ref(false);
	const showEditName = ref(false);
	const showEditRoom = ref(false);

	onMounted(async () => {
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

	function renamePublicRoom(room: PublicRoom) {
		editRoomName.value = room;
		secured.value = false;
		showEditName.value = true;
	}

	function closeRename() {
		editRoomName.value = {} as PublicRoom;
		secured.value = false;
		showEditName.value = false;
	}

	function EditSecuredRoom(room: SecuredRoom) {
		editRoom.value = room;
		secured.value = true;
		showEditRoom.value = true;
	}

	function closeEdit() {
		editRoom.value = {} as SecuredRoom;
		secured.value = false;
		showEditRoom.value = false;
	}

	async function removePublicRoom(room: PublicRoom) {
		const dialog = useDialog();
		if (await dialog.okcancel(t('admin.remove_room_sure'))) {
			try {
				await rooms.removePublicRoom(room.room_id);
			} catch (error) {
				dialog.confirm('ERROR', error as string);
			}
		}
	}

	async function removeSecuredRoom(room: SecuredRoom) {
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
