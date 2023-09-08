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
						<ul v-else>
							<li v-for="room in rooms.nonSecuredPublicRooms" :key="room.room_id" class="group hover:bg-green p-1 rounded">
								<Icon :type="roomIcon(room)" class="mr-4 float-left text-green group-hover:text-black"></Icon>
								<span :title="room.room_id">
									{{ room.name }} <span>[{{ room.num_joined_members }} {{ $t('rooms.members') }}]</span>
								</span>
								<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removePublicRoom(room)"></Icon>
								<Icon type="edit" class="float-right mr-1 cursor-pointer hover:text-white" @click="renamePublicRoom(room)"></Icon>
							</li>
						</ul>
					</TabContent>

					<TabContent>
						<p v-if="!rooms.hasSecuredRooms">{{ $t('admin.no_secured_rooms') }}</p>
						<ul v-else>
							<li v-for="room in rooms.sortedSecuredRooms" :key="room.room_id" class="group hover:bg-green p-1 rounded">
								<Icon type="lock" class="mr-4 float-left text-green group-hover:text-black"></Icon>
								<span :title="room.room_id">
									{{ room.room_name }} <span v-if="room.user_txt !== ''">- {{ room.user_txt }}</span>
								</span>
								<Icon type="remove" class="float-right cursor-pointer hover:text-red" @click="removeSecuredRoom(room)"></Icon>
								<Icon type="edit" class="float-right mr-1 cursor-pointer hover:text-white" @click="EditSecuredRoom(room)"></Icon>
							</li>
						</ul>
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
	import { PubHubsRoomType, PublicRoom, SecuredRoom, useRooms, useDialog } from '@/store/store';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const rooms = useRooms();
	const editRoomName = ref({} as PublicRoom);
	const editRoom = ref({} as SecuredRoom | PublicRoom);
	const secured = ref(false);
	const showEditName = ref(false);
	const showEditRoom = ref(false);

	onMounted(async () => {
		await rooms.fetchSecuredRooms();
	});

	function isSecuredRoom(room: PublicRoom) {
		return typeof room.room_type !== 'undefined' && room.room_type !== PubHubsRoomType.PH_MESSAGES_RESTRICTED;
	}

	function roomIcon(room: PublicRoom) {
		if (isSecuredRoom(room)) {
			return 'lock';
		}
		return 'room';
	}

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
