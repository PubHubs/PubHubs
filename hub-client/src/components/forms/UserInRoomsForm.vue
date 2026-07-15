<template>
	<Dialog
		:buttons="[]"
		:title="$t('admin.user_perm_heading') + ' - ' + displayName"
		:width="isMobile ? 'px-400 w-full' : 'w-[600px] px-400'"
		@close="emit('close')"
	>
		<div class="flex flex-col gap-200 pb-150">
			<!-- Chat rooms are excluded from this dialog on purpose; say so instead of leaving users guessing. -->
			<p class="text-on-surface-dim text-label-small">{{ t('admin.user_perm_public_only') }}</p>

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

				<div class="text-label w-full">
					<div
						v-for="room in filteredRooms"
						:key="room.room_id"
						class="border-on-surface-dim flex w-full items-center gap-200 border-t py-150"
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
								v-if="isRoomAdmin(room.room_id)"
								class="bg-accent-red text-on-accent-red py-thin inline-block rounded-md px-100"
								:title="t('admin.user_perm_room_admin_locked')"
								>{{ roles.getRoleByPowerLevel(room.room_pl) }}</span
							>
							<template v-else>
								<DropDown
									v-model="room.room_pl"
									:clearable="false"
									:disabled="savingRoomId === room.room_id"
									:inline="true"
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
	</Dialog>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import DropDown from '@hub-client/components/forms/elements/DropDown.vue';
	import TextField from '@hub-client/components/forms/elements/TextField.vue';
	import Dialog from '@hub-client/components/ui/Dialog.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	import { useRoles } from '@hub-client/composables/roles.composable';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiService';

	// Models
	import { Administrator } from '@hub-client/models/hubmanagement/models/admin';
	import { type UserRoomPermission } from '@hub-client/models/hubmanagement/types/roomPerm';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';
	import { type FieldOption } from '@hub-client/models/validation/TFormOption';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps({
		userId: { type: String, required: true },
		displayName: { type: String, required: true },
		administrator: { type: Administrator, required: true },
	});

	const emit = defineEmits(['close']);
	const { t } = useI18n();
	const pubhubs = usePubhubsStore();
	const roles = useRoles();
	const user = useUser();
	const settings = useSettings();

	const isMobile = computed(() => settings.isMobileState);

	const loading = ref(true);
	const filter = ref('');
	const listUserRooms = ref<UserRoomPermission[]>([]);
	const adminJoinedRooms = ref<string[]>([]);

	// Role changes apply per row, immediately. savedPl holds the last backend-confirmed power level
	// per room so a failed change can be reverted to reality instead of what the dropdown claims.
	const savedPl = ref<Record<string, number>>({});
	const savingRoomId = ref<string | null>(null);
	const rowSaved = ref<Record<string, boolean>>({});
	const rowError = ref<Record<string, string>>({});

	// Room admin (100) is deliberately not offered; rooms need exactly one admin, the creator.
	const powerLevelOptions = [0, 50];

	function roleTransformer(value: number): FieldOption {
		if (value === 0) return { label: t('admin.title_user'), value: '0' };
		if (value === 50) return { label: t('admin.title_steward'), value: '50' };
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
			const roomsPerm = await props.administrator.showUserPermissions(props.userId);
			// Only display public rooms and not chat.
			listUserRooms.value = roomsPerm.filter((room) => room.public === true);
			savedPl.value = Object.fromEntries(listUserRooms.value.map((room) => [room.room_id, Number(room.room_pl)]));

			const joinedRooms = await APIService.adminListJoinedRoomId(user.userId ?? '');
			adminJoinedRooms.value = joinedRooms.joined_rooms;
		} finally {
			loading.value = false;
		}
	}

	onMounted(load);
	watch(() => props.userId, load);

	async function onRoleChange(room: UserRoomPermission) {
		const roomId = room.room_id;
		const newPl = Number(room.room_pl);
		const prevPl = savedPl.value[roomId];
		if (newPl === prevPl || savingRoomId.value !== null) return;

		delete rowSaved.value[roomId];
		delete rowError.value[roomId];
		savingRoomId.value = roomId;

		// Permissions can only be changed from inside the room, so join temporarily when needed.
		const wasMember = adminJoinedRooms.value.includes(roomId);
		try {
			if (!wasMember) {
				await pubhubs.joinRoom(roomId);
			}
			await props.administrator.changePermission(props.userId, roomId, newPl);
			savedPl.value[roomId] = newPl;
			rowSaved.value[roomId] = true;
		} catch {
			room.room_pl = prevPl;
			rowError.value[roomId] = t('admin.not_admin_perm_msg');
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
	}

	function isRoomAdmin(roomId: string) {
		return listUserRooms.value.find((room) => room.room_id === roomId)?.room_pl === UserPowerLevel.Admin;
	}
</script>
