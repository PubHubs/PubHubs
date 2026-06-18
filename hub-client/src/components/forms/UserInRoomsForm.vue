<!-- Protection against the issue of multiple admin. Only add admin that creates the room can only see the room.
	TODO: Discuss in PH general meeting about the issue of PH admins - we should have only one admin who can create the room. -->
<template>
	<Dialog
		v-if="listUserRooms.length > 0"
		:buttons="buttonsSubmitCancel"
		:title="$t('admin.user_perm_heading') + ' - ' + displayName"
		:width="isMobile ? 'px-400 w-full' : 'w-[700px] px-400'"
		@close="emit('close')"
	>
		<!-- Table header -->
		<div class="text-label-small-min/label-small-max text-on-surface-dim mt-400 mb-100 flex w-full items-center gap-200 px-300">
			<div class="flex-[2] font-medium">
				{{ t('admin.title_room') }}
			</div>
			<div class="flex-[1] font-medium">
				{{ t('admin.title_permission') }}
			</div>
			<div class="flex-[2] font-medium">
				{{ t('admin.title_update') }}
			</div>
		</div>

		<!-- Scrollable table body -->
		<div class="text-label max-h-[180px] w-full overflow-x-hidden overflow-y-auto sm:max-h-[250px]">
			<div
				v-for="room in listUserRooms"
				:key="room.room_id"
				class="border-on-surface-dim flex w-full items-center gap-200 border-t px-300 py-150"
			>
				<div class="flex-[2] truncate">
					{{ room.room_name }}
				</div>
				<div class="flex-[1]">
					<span :class="'py-thin inline-block rounded-md px-100 ' + getTagClassBasedOnRole(room.room_pl)">{{
						roles.getRoleByPowerLevel(room.room_pl)
					}}</span>
				</div>
				<div class="flex-[2]">
					<template v-if="isRoomAdmin(room.room_id)">
						<span class="bg-accent-red py-thin inline-block rounded-md px-100">{{ roles.getRoleByPowerLevel(room.room_pl) }}</span>
					</template>
					<DropDown
						v-else
						v-model="room.room_pl"
						:clearable="false"
						:inline="true"
						:options="powerLevelOptions"
						:transformer="roleTransformer"
						@update:model-value="updateData('permission', { roomId: room.room_id, pl: room.room_pl })"
					/>
				</div>
			</div>
		</div>
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import DropDown from '@hub-client/components/forms/elements/DropDown.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	import { useRoles } from '@hub-client/composables/roles.composable';
	import { type FormDataType, useFormState } from '@hub-client/composables/useFormState';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiService';

	// Models
	import { Administrator } from '@hub-client/models/hubmanagement/models/admin';
	import { type UserRoomPermission } from '@hub-client/models/hubmanagement/types/roomPerm';
	import { UserPowerLevel, UserRole } from '@hub-client/models/users/TUser';
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	// Stores
	import { DialogOk, buttonsSubmitCancel, useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps({
		userId: { type: String, required: true },
		displayName: { type: String, required: true },
		administrator: { type: Administrator, required: true },
	});
	const emit = defineEmits(['close']);
	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const roles = useRoles();
	const dialog = useDialog();
	const user = useUser();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	let listUserRooms = ref<UserRoomPermission[]>([]);
	let originalJoinedRooms = ref<string[]>([]);

	const powerLevelOptions = [0, 50];

	function roleTransformer(value: number): FieldOption {
		if (value === 0) return { label: t('admin.title_user'), value: '0' };
		if (value === 50) return { label: t('admin.title_steward'), value: '50' };
		return { label: String(value), value: String(value) };
	}

	const { data, setData, dataIsChanged, changed, updateData, setSubmitButton } = useFormState();

	setData({
		//
		permission: { value: {} as FormDataType },
	});

	onMounted(async () => {
		listUserRooms.value = await fetchRoomUserPermissions();

		const joinedRooms = await APIService.adminListJoinedRoomId(user.userId ?? '');
		originalJoinedRooms.value = joinedRooms.joined_rooms;

		dialog.addCallback(DialogOk, async () => {
			if (changed) {
				if (dataIsChanged('permission')) {
					const permValue = data.permission.value as { roomId: string; pl: number };
					const roomId = permValue.roomId;
					const powerlevel = permValue.pl;

					const wasMember = originalJoinedRooms.value.includes(roomId);

					try {
						if (!wasMember) {
							await pubhubs.joinRoom(roomId);
						}
						await props.administrator.changePermission(props.userId, roomId, powerlevel);
						if (!wasMember) {
							await pubhubs.leaveRoom(roomId);
						}
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

			const joinedRooms = await APIService.adminListJoinedRoomId(user.userId ?? '');
			originalJoinedRooms.value = joinedRooms.joined_rooms;
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

	// Admin Room Status Methods //

	function isRoomAdmin(roomId: string) {
		return listUserRooms.value.find((room) => room.room_id === roomId)?.room_pl === UserPowerLevel.Admin;
	}

	// Presentation methods //

	function getTagClassBasedOnRole(powerLevel: number) {
		const currentRole = roles.getRoleByPowerLevel(powerLevel);
		if (currentRole === UserRole.Admin) return 'bg-accent-red text-on-accent-red';
		if (currentRole === UserRole.Steward) return 'bg-accent-steward text-on-accent-steward';
		return 'bg-accent-primary text-on-accent-primary';
	}
</script>
