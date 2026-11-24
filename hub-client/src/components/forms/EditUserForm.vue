<template>
	<div
		class="flex w-full flex-col gap-200 pb-150"
		:class="isMobile ? 'px-150' : 'max-w-7000 px-400'"
	>
		<div class="flex items-center gap-100">
			<IconButton
				:aria-label="t('dialog.back')"
				icon="caret-left"
				size="sm"
				:title="t('dialog.back')"
				variant="secondary"
				@click="emit('close')"
			/>
			<p class="text-h3 font-headings min-w-0 truncate font-semibold">{{ t('admin.user_perm_heading') }} - {{ displayName }}</p>
		</div>

		<!-- Chat rooms are excluded from this page on purpose; say so instead of leaving users guessing. -->
		<p class="text-on-surface-dim text-label-small">{{ administrator ? t('admin.user_perm_public_only') : t('admin.user_perm_moderated_only') }}</p>

		<InlineSpinner v-if="loading" />

		<p
			v-else-if="listUserRooms.length === 0"
			class="text-on-surface-dim"
		>
			{{ t('admin.user_perm_no_rooms') }}
		</p>

		<template v-else>
			<TextField
				v-if="listUserRooms.length > 8"
				v-model="filter"
				:aria-label="t('others.search')"
				icon="magnifying-glass"
				:placeholder="t('others.search')"
			/>

			<div>
				<div
					v-for="room in filteredRooms"
					:key="room.room_id"
					class="border-on-surface-disabled/25 text-label flex items-center gap-200 border-t py-150"
				>
					<div class="min-w-0 flex-2">
						<p class="truncate">{{ room.room_name }}</p>
						<p
							v-if="rowError[room.room_id]"
							aria-live="assertive"
							class="text-accent-red text-label-small text-pretty"
							role="alert"
						>
							{{ rowError[room.room_id] }}
						</p>
					</div>
					<div class="flex flex-1 items-center gap-100">
						<span
							v-if="isLocked(room)"
							class="border-accent-steward text-accent-steward text-label-tiny rounded-base px-075 py-025 border-2 uppercase"
							:title="lockedReason(room)"
							>{{ roles.getRoleByPowerLevel(room.room_pl) }}</span
						>
						<template v-else>
							<DropDown
								v-model="room.room_pl"
								:clearable="false"
								:disabled="savingRoomId !== null"
								inline
								:options="powerLevelOptions"
								:transformer="roleTransformer"
								@update:model-value="onRoleChange(room)"
							/>
							<InlineSpinner v-if="savingRoomId === room.room_id" />
							<Icon
								v-else-if="rowSaved[room.room_id]"
								class="text-accent-primary"
								size="sm"
								:title="t('admin.user_perm_saved')"
								type="check"
							/>
						</template>
					</div>
				</div>
			</div>
		</template>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import IconButton from '@hub-client/components/elements/IconButton.vue';
	import DropDown from '@hub-client/components/forms/elements/DropDown.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { usePowerLevels } from '@hub-client/composables/usePowerLevels';
	import { useUserRooms } from '@hub-client/composables/useUserRooms';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiService';

	// Models
	import { type Administrator } from '@hub-client/models/hubmanagement/models/admin';
	import { type UserRoomPermission } from '@hub-client/models/hubmanagement/types/roomPerm';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Props
	// Without an administrator the current user is a steward, who can only manage the rooms they moderate.
	const props = withDefaults(
		defineProps<{
			administrator?: Administrator | null;
			displayName: string;
			userId: string;
		}>(),
		{
			administrator: null,
		},
	);

	const emit = defineEmits(['close']);
	const { t } = useI18n();
	const dialog = useDialog();
	const pubhubs = usePubhubsStore();
	const roles = useRoles();
	const { powerLevel } = usePowerLevels();
	const user = useUser();
	const settings = useSettings();

	// Stewards can't use the admin API, so their rooms come from the local room list
	const { visibleRooms: moderatedRooms } = useUserRooms(
		computed(() => props.userId),
		computed(() => false),
	);

	const isMobile = computed(() => settings.isMobileState);

	const loading = ref(true);
	const filter = ref('');
	const listUserRooms = ref<UserRoomPermission[]>([]);
	const adminJoinedRooms = ref<string[]>([]);

	// Role changes apply per row, immediately. savedPl holds the last backend-confirmed power level
	// per room so a failed change can be reverted to reality instead of what the dropdown claims.
	const savedPowerLevel = ref<Record<string, number>>({});
	// One save at a time: every row's dropdown is disabled while it runs, so no change gets dropped
	const savingRoomId = ref<string | null>(null);
	const rowSaved = ref<Record<string, boolean>>({});
	const rowError = ref<Record<string, string>>({});

	// Room admin (100) is deliberately not offered; rooms need exactly one admin, the creator.
	const powerLevelOptions = [UserPowerLevel.User, UserPowerLevel.Expert, UserPowerLevel.Steward];

	function roleTransformer(value: number): FieldOption {
		if (value === UserPowerLevel.User) return { label: t('admin.title_user'), value: String(UserPowerLevel.User) };
		if (value === UserPowerLevel.Expert) return { label: t('expert.expert'), value: String(UserPowerLevel.Expert) };
		if (value === UserPowerLevel.Steward) return { label: t('admin.title_steward'), value: String(UserPowerLevel.Steward) };
		return { label: String(value), value: String(value) };
	}

	const filteredRooms = computed(() => {
		const term = filter.value.trim().toLowerCase();
		if (!term) return listUserRooms.value;
		return listUserRooms.value.filter((room) => (room.room_name ?? '').toLowerCase().includes(term));
	});

	async function load() {
		loading.value = true;
		rowSaved.value = {};
		rowError.value = {};
		try {
			if (props.administrator) {
				const roomsPerm = await props.administrator.showUserPermissions(props.userId);
				// Only display public rooms and not chat.
				listUserRooms.value = roomsPerm.filter((room) => room.public === true);

				const joinedRooms = await APIService.adminListJoinedRoomId(user.userId ?? '');
				adminJoinedRooms.value = joinedRooms.joined_rooms;
			} else {
				listUserRooms.value = moderatedRoomsOfUser();
				adminJoinedRooms.value = listUserRooms.value.map((room) => room.room_id);
			}
			savedPowerLevel.value = Object.fromEntries(listUserRooms.value.map((room) => [room.room_id, Number(room.room_pl)]));
		} finally {
			loading.value = false;
		}
	}

	/**
	 * Rooms (except chats) the user has joined and the current user moderates, with both their power levels.
	 */
	const moderatedRoomsOfUser = (): UserRoomPermission[] =>
		moderatedRooms.value.map(({ roomId, name }) => ({
			room_id: roomId,
			room_name: name,
			room_pl: powerLevel(roomId, props.userId),
			public: true,
			admin_permission: powerLevel(roomId),
		}));

	onMounted(load);
	watch(() => props.userId, load);

	async function onRoleChange(room: UserRoomPermission) {
		const roomId = room.room_id;
		const newPl = Number(room.room_pl);
		const prevPl = savedPowerLevel.value[roomId];
		if (newPl === prevPl || savingRoomId.value !== null) return;

		if (props.userId !== user.userId || newPl >= prevPl) {
			await saveRole(room);
			return;
		}

		if (!(await dialog.okcancel(t('roles.demote_self_confirm', { room: room.room_name })))) {
			room.room_pl = prevPl;
			return;
		}
		if (await saveRole(room)) {
			// The rooms listed here depend on the current user's own roles, which just changed.
			emit('close');
		}
	}

	/**
	 * @returns whether the change was saved
	 */
	const saveRole = async (room: UserRoomPermission): Promise<boolean> => {
		const roomId = room.room_id;
		const newPl = Number(room.room_pl);
		const prevPl = savedPowerLevel.value[roomId];

		delete rowSaved.value[roomId];
		delete rowError.value[roomId];
		savingRoomId.value = roomId;

		// Permissions can only be changed from inside the room, so join temporarily when needed.
		const wasMember = adminJoinedRooms.value.includes(roomId);
		try {
			if (!wasMember) {
				await pubhubs.joinRoom(roomId);
			}
			if (props.administrator) {
				await props.administrator.changePermission(props.userId, roomId, newPl);
			} else {
				await pubhubs.client.setPowerLevel(roomId, props.userId, newPl);
			}
			savedPowerLevel.value[roomId] = newPl;
			rowSaved.value[roomId] = true;
			return true;
		} catch {
			room.room_pl = prevPl;
			rowError.value[roomId] = props.administrator ? t('admin.not_admin_perm_msg') : t('admin.user_perm_change_failed');
			return false;
		} finally {
			if (!wasMember) {
				try {
					await pubhubs.leaveRoom(roomId);
				} catch {
					// The temporary join may not have succeeded; nothing to clean up then.
				}
			}
			savingRoomId.value = null;
		}
	};

	// Matrix doesn't let a steward lower someone else at their own level, so stewards can't change other stewards.
	const isLocked = (room: UserRoomPermission) => {
		if (room.room_pl === UserPowerLevel.Admin) return true;
		return !props.administrator && props.userId !== user.userId && room.room_pl >= room.admin_permission;
	};

	const lockedReason = (room: UserRoomPermission) =>
		room.room_pl === UserPowerLevel.Admin ? t('admin.user_perm_room_admin_locked') : t('admin.user_perm_steward_locked');
</script>
