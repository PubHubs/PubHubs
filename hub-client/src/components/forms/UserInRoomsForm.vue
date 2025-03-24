<template>
	<div class="absolute inset-0 z-20 h-full bg-gray-middle opacity-75"></div>
	<div
		v-if="listUserRooms.length > 0"
		class="border-b-1 border-x-1 absolute left-1/2 top-40 z-20 max-h-[80%] w-[95%] -translate-x-1/2 transform overflow-hidden rounded-md bg-hub-background-2 p-4 dark:text-white-middle sm:w-[80%] sm:p-8 md:w-[40%]"
	>
		<div class="flex justify-between">
			<h2 class="light:text-black mx-2 my-2 mt-4 text-lg font-bold theme-light:text-black">{{ t('admin.user_perm_heading') }}</h2>
			<Icon type="close" size="md" class="mt-4 hover:text-red theme-light:text-gray theme-light:hover:text-red" @click="$emit('close')"></Icon>
		</div>
		<hr class="mx-4 mb-4 mt-2 border-gray-lighter sm:mx-8" />
		<div class="flex p-2 sm:p-4">
			<Avatar :user="user" :overrideAvatarUrl="avatarUrl"></Avatar>
			<div class="ml-2 flex flex-col">
				<div class="text-base text-black sm:text-lg">{{ displayName }}</div>
				<div class="sm:text-md mb-2 text-sm text-gray-middle sm:mb-4">{{ userId }}</div>
			</div>
		</div>
		<div class="flex justify-center">
			<span class="sm:text-md mb-2 rounded-md bg-blue-light px-2 text-sm font-medium text-white"><Icon type="exclamation" class="inline"></Icon> {{ t('admin.important_perm_msg') }}</span>
		</div>
		<hr class="mx-4 mb-4 mt-2 border-gray-lighter sm:mx-8" />

		<!-- Table header -->
		<div class="w-full">
			<div class="grid w-full grid-cols-3 text-left text-sm text-gray-darker dark:text-white rtl:text-right">
				<div class="sm:text-md px-2 py-3 text-sm font-medium sm:px-6">{{ t('admin.title_room') }}</div>
				<div class="sm:text-md px-1 py-3 text-sm font-medium">{{ t('admin.title_permission') }}</div>
				<div class="sm:text-md px-2 py-3 text-sm font-medium sm:px-6">{{ t('admin.title_update') }}</div>
			</div>
		</div>

		<!-- Scrollable table body -->
		<div class="max-h-[180px] w-full overflow-y-auto overflow-x-hidden sm:max-h-[250px]">
			<div v-for="room in listUserRooms" :key="room.room_id" class="grid w-full grid-cols-3 border-t border-gray-lighter">
				<div class="truncate px-2 py-2 text-sm sm:px-6 sm:py-4 sm:text-lg">{{ room.room_name }}</div>
				<div class="px-1 py-2 sm:py-4">
					<span :class="'inline-block rounded-md px-1 text-xs text-white sm:px-2 sm:text-sm ' + getTagBasedOnRole(room.room_pl)">{{ showPermissionRole(room.room_pl) }}</span>
				</div>
				<div class="px-2 py-2 sm:px-6 sm:py-4">
					<div v-if="adminIsMember(room.room_id)" class="ml-0 sm:ml-2">
						<select
							:disabled="isRoomAdmin(room.room_id)"
							class="peer block w-full appearance-none border-0 border-gray-lighter bg-gray-lighter px-2 py-1 text-xs text-gray-middle focus:border-gray-light focus:outline-none focus:ring-0 dark:border-gray-darker dark:text-gray-middle sm:px-8 sm:py-2.5 sm:text-sm"
							:class="isRoomAdmin(room.room_id) ? 'bg-transparent bg-none' : ''"
							v-model="room.room_pl"
							@change="changeUserPermission(room.room_id, room.room_pl)"
						>
							<option :value="0">{{ t('admin.title_user') }}</option>
							<option :value="50">{{ t('admin.title_steward') }}</option>
						</select>
					</div>
					<div v-else>
						<button @click="adminJoinRoom(room.room_id)" class="ml-0 rounded bg-blue px-2 py-1 text-xs text-white transition hover:bg-blue-dark sm:ml-2 sm:px-3 sm:text-sm">{{ $t('admin.join') }}</button>
					</div>
				</div>
			</div>
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
	import Avatar from '../ui/Avatar.vue';

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
		const roomsPerm = await props.administrator.showUserPermissions(props.userId);
		const publicRoomsPerm = roomsPerm.filter((room) => room.public === true);
		// Only display public rooms and not chat.
		if (publicRoomsPerm.length === 0) {
			dialog.confirm(t('errors.no_room_error', props.userId));
			emit('close');
		}
		return publicRoomsPerm;
	}

	async function changeUserPermission(roomId: string, newRole: number) {
		try {
			await props.administrator.changePermission(props.userId, roomId, newRole);
		} catch {
			await dialog.confirm(t('admin.not_admin_perm_msg'));
		}
	}

	function showPermissionRole(powerLevel: number): string {
		switch (powerLevel) {
			case 50:
				return TUserRole.Steward;

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

		if (currentRole === 'Steward') return 'bg-avatar-green';

		return 'bg-avatar-yellow';
	}
</script>
