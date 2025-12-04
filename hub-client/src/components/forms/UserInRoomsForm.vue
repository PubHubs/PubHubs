<!-- Protection against the issue of multiple admin. Only add admin that creates the room can only see the room.
	TODO: Discuss in PH general meeting about the issue of PH admins - we should have only one admin who can create the room. -->
<template>
	<Dialog v-if="listUserRooms.length > 0" :title="$t('admin.user_perm_heading')" @close="emit('close')" :buttons="buttonsSubmitCancel">
		<div class="flex p-2 sm:p-4">
			<Avatar :avatar-url="user.userAvatar(userId)" :user-id="userId"></Avatar>
			<div class="ml-2 flex flex-col">
				<div>{{ displayName }}</div>
				<div class="text-on-surface-dim mb-2 italic sm:mb-4">{{ userId }}</div>
			</div>
		</div>
		<div class="bg-accent-primary text-on-accent-primary flex gap-2 rounded-md p-2">
			<Icon type="warning-circle" class="" />
			<span class="font-medium">{{ t('admin.important_perm_msg') }}</span>
		</div>

		<!-- Table header -->
		<div class="text-label-small-min/label-small-max text-on-surface-dim mt-8 mb-2 grid w-full grid-cols-3 text-left rtl:text-right">
			<div class="font-medium sm:px-6">{{ t('admin.title_room') }}</div>
			<div class="font-medium">{{ t('admin.title_permission') }}</div>
			<div class="font-medium sm:px-8">{{ t('admin.title_update') }}</div>
		</div>

		<!-- Scrollable table body -->
		<div class="text-label max-h-[180px] w-full overflow-x-hidden overflow-y-auto sm:max-h-[250px]">
			<div v-for="room in listUserRooms" :key="room.room_id" class="border-on-surface-dim grid w-full grid-cols-3 border-t">
				<div class="truncate px-2 py-2 sm:px-6 sm:py-4">{{ room.room_name }}</div>
				<div class="px-1 py-2 sm:py-4">
					<span :class="'inline-block rounded-md px-1 sm:px-2 ' + getTagBasedOnRole(room.room_pl)">{{ showPermissionRole(room.room_pl) }}</span>
				</div>
				<div class="px-4 py-2 sm:px-6 sm:py-4">
					<div v-if="adminIsMember(room.room_id)" class="ml-0 sm:ml-2">
						<select
							:disabled="isRoomAdmin(room.room_id)"
							class="w-full truncate px-2 py-2 ring-1 focus:outline-none sm:px-8 sm:py-2"
							:class="isRoomAdmin(room.room_id) ? 'bg-transparent bg-none' : ''"
							v-model="room.room_pl"
							@change="updateData('permission', { roomId: room.room_id, pl: room.room_pl })"
						>
							<option :value="0" class="active:bg-accent-primary">{{ t('admin.title_user') }}</option>
							<option :value="50">{{ t('admin.title_steward') }}</option>
						</select>
					</div>
					<div v-else>
						<button @click="adminJoinRoom(room.room_id)" class="bg-accent-primary ml-0 rounded-xs px-2 py-1 transition sm:ml-2 sm:px-3">{{ $t('admin.join') }}</button>
					</div>
				</div>
			</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { FormDataType, useFormState } from '@hub-client/composables/useFormState';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiHubManagement';

	// Models
	import { Administrator } from '@hub-client/models/hubmanagement/models/admin';
	import { UserRoomPermission } from '@hub-client/models/hubmanagement/types/roomPerm';
	import { TUserJoinedRooms } from '@hub-client/models/users/TUser';
	import { TUserRole } from '@hub-client/models/users/TUser';

	// Stores
	import { DialogButton, DialogOk, buttonsSubmitCancel, useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const dialog = useDialog();
	const user = useUser();

	let listUserRooms = ref<UserRoomPermission[]>([]);
	let joinedMembers = ref<TUserJoinedRooms>();

	const { data, setData, dataIsChanged, changed, updateData, setSubmitButton } = useFormState();

	setData({
		//
		permission: { value: {} as FormDataType },
	});

	const emit = defineEmits(['close']);

	const props = defineProps({
		userId: { type: String, required: true },
		displayName: { type: String, required: true },
		administrator: { type: Administrator, required: true },
	});

	onMounted(async () => {
		listUserRooms.value = await fetchRoomUserPermissions();

		joinedMembers.value = await APIService.adminListJoinedRoomId(user.userId);

		dialog.addCallback(DialogOk, async () => {
			if (changed) {
				if (dataIsChanged('permission')) {
					const roomId = data.permission.value.roomId;
					const powerlevel = data.permission.value.pl;

					try {
						await props.administrator.changePermission(props.userId, roomId, powerlevel);
					} catch {
						await dialog.confirm(t('admin.not_admin_perm_msg'));
						emit('close');
					}
				}
			}
		});
		setSubmitButton(dialog.properties.buttons[0]);
	});

	watch(
		() => props.userId,
		async () => {
			listUserRooms.value = await fetchRoomUserPermissions();

			joinedMembers.value = await APIService.adminListJoinedRoomId(user.userId);
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

		if (currentRole === 'Administrator') return 'bg-accent-red';

		if (currentRole === 'Steward') return 'bg-accent-lime';

		return 'bg-accent-yellow';
	}
</script>
