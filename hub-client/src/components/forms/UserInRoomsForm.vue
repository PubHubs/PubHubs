<template>
	<div class="absolute inset-0 z-20 h-full bg-gray-middle opacity-75"></div>
	<div v-if="listUserRooms.length > 0" class="border-b-1 border-x-1 absolute top-40 z-30 m-auto mb-2 max-h-[80vh] w-1/2 overflow-y-auto rounded-md bg-hub-background-2 p-8 dark:text-white-middle">
		<div class="flex justify-between">
			<h2 class="light:text-black mx-2 my-2 mt-4 text-lg font-bold theme-light:text-black">{{ t('admin.user_perm_heading') }}</h2>
			<Icon type="close" size="md" class="mt-4 hover:text-red theme-light:text-gray theme-light:hover:text-red" @click="$emit('close')"></Icon>
		</div>
		<hr class="mx-8 mb-4 mt-2 border-gray-lighter" />
		<div class="flex p-4">
			<Avatar :userId="userId" :img="avatarUrl != null ? avatarUrl : ''"></Avatar>
			<div class="ml-2 flex flex-col">
				<div class="text-lg text-black">{{ displayName }}</div>
				<div class="text-md mb-4 text-gray-middle">{{ userId }}</div>
			</div>
		</div>

		<div class="flex justify-center">
			<span class="text-md mb-2 rounded-md bg-blue-light px-2 font-medium text-white"><Icon type="exclamation" class="inline"></Icon> {{ t('admin.important_perm_msg') }}</span>
		</div>
		<hr class="mx-8 mb-4 mt-2 border-gray-lighter" />

		<div>
			<table class="w-full text-left text-sm text-gray-darker dark:text-white rtl:text-right">
				<thead class="text-md">
					<tr>
						<th scope="col" class="px-6 py-3">{{ t('admin.title_room') }}</th>
						<th scope="col" class="py-3">{{ t('admin.title_permission') }}</th>
						<th scope="col" class="px-6 py-3">{{ t('admin.title_update') }}</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="room in listUserRooms" :key="room.room_id">
						<td class="px-6 py-4 text-lg">{{ room.room_name }}</td>
						<td :class="'font-lg mt-4 inline-block rounded-md px-2 text-sm text-white ' + getTagBasedOnRole(room.room_pl)">{{ showPermissionRole(room.room_pl) }}</td>
						<td>
							<div v-if="adminIsMember(room.room_id)" class="ml-2">
								<select
									:disabled="isRoomAdmin(room.room_id)"
									class="peer block w-full appearance-none border-0 border-gray-lighter bg-gray-lighter px-8 py-2.5 text-sm text-gray-middle focus:border-gray-light focus:outline-none focus:ring-0 dark:border-gray-darker dark:text-gray-middle"
									:class="isRoomAdmin(room.room_id) ? 'bg-transparent bg-none' : ''"
									v-model="room.room_pl"
									@change="changeUserPermission(room.room_id, room.room_pl)"
								>
									<option :value="0">{{ t('admin.title_user') }}</option>
									<option :value="50">{{ t('admin.title_moderator') }}</option>
								</select>
							</div>
							<div v-else>
								<button @click="adminJoinRoom(room.room_id)" class="ml-2 rounded bg-blue px-3 py-1 text-white transition hover:bg-blue-dark">{{ $t('admin.join') }}</button>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
<script setup lang="ts">
	/**
	 *  Protection against the issue of multiple admin. Only add admin that creates the room can only see the room.
	 *  TODO: Discuss in PH general meeting about the issue of PH admins - we should have only one admin who can create the room.
	 */

	import { onMounted, watch, ref } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useUser } from '@/logic/store/user';
	import { useDialog } from '@/logic/store/dialog';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { TUserJoinedRooms } from '@/model/users/TUser';
	import { TUserRole } from '@/model/users/TUser';
	import { APIService } from '@/logic/core/apiHubManagement';
	import { UserRoomPermission } from '@/model/hubmanagement/types/roomPerm';
	import { Administrator } from '@/model/hubmanagement/models/admin';

	const { t } = useI18n();

	const pubhubs = usePubHubs();
	const dialog = useDialog();
	const user = useUser();

	let listUserRooms = ref<UserRoomPermission[]>([]);
	let joinedMembers = ref<TUserJoinedRooms>();

	const emit = defineEmits(['close']);

	const props = defineProps({
		userId: { type: String, required: true },
		displayName: { type: String, required: true },
		avatarUrl: { type: String },
		administrator: { type: Administrator, required: true },
	});

	onMounted(async () => {
		listUserRooms.value = await fetchRoomUserPermissions();

		joinedMembers.value = await APIService.adminListJoinedRoomId(user.user.userId);
	});

	watch(
		() => props.userId,
		async () => {
			listUserRooms.value = await fetchRoomUserPermissions();

			joinedMembers.value = await APIService.adminListJoinedRoomId(user.user.userId);
		},
	);

	// Fetch permissions methods //

	async function fetchRoomUserPermissions(): Promise<UserRoomPermission[]> {
		const rooms = await props.administrator.showUserPermissions(props.userId);

		// Only display public rooms and not chat.
		if (rooms.length === 0) {
			dialog.confirm(t('errors.no_room_error', props.userId));

			emit('close');
		}

		return rooms.filter((room) => room.public === true);
	}

	async function changeUserPermission(roomId: string, newRole: number) {
		try {
			const response = await props.administrator.changePermission(props.userId, roomId, newRole);
			emit('close');
			if (response.event_id !== undefined) {
				await dialog.confirm(t('admin.permission_success'));
			}
		} catch {
			await dialog.confirm(t('admin.not_admin_perm_msg'));
		}
	}

	function showPermissionRole(powerLevel: number): string {
		switch (powerLevel) {
			case 50:
				return TUserRole.Moderator;

			case 100:
				return TUserRole.Administrator;

			default:
				return TUserRole.User;
		}
	}

	// Admin Room Status Methods //

	function adminIsMember(roomId: string) {
		if (!joinedMembers.value) return;

		return joinedMembers.value?.joined_rooms.find((joinedRoomId) => roomId === joinedRoomId) !== undefined;
	}

	async function adminJoinRoom(roomId: string) {
		// Join the room
		await pubhubs.joinRoom(roomId);
		// Update the joinedMembers state

		if (joinedMembers.value) {
			joinedMembers.value.joined_rooms.push(roomId); // Add the roomId to the joined_rooms array
		}
	}

	function isRoomAdmin(roomId: string) {
		return listUserRooms.value.find((room) => room.room_id === roomId)!.room_pl === 100;
	}

	// Presentation methods //

	function getTagBasedOnRole(powerLevel: number) {
		const currentRole = showPermissionRole(powerLevel);

		if (currentRole === 'Administrator') return 'bg-avatar-red';

		if (currentRole === 'Moderator') return 'bg-avatar-green';

		return 'bg-avatar-yellow';
	}
</script>
