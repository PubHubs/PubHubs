<template>
	<div class="bg-surface absolute inset-0 z-20 h-full opacity-75" />
	<div class="fixed inset-0 z-20 flex items-center justify-center p-200">
		<div class="bg-surface-base relative min-h-[300px] rounded-md border p-400 sm:w-[480px] md:w-[640px]">
			<div class="flex justify-between">
				<h2 class="mx-100 my-100 mt-200 font-bold">
					{{ t('admin.title_room_join') }}
				</h2>
				<Icon
					type="x"
					@click="close()"
				/>
			</div>

			<hr class="mx-400 mt-100" />
			<div class="my-100 flex flex-col">
				<span>{{ t('admin.join_warning') }}</span>
				<span class="mt-200">{{ t('admin.refresh_admin_operation') }} </span>
			</div>

			<hr class="mx-400 mt-100" />
			<Button
				class="bg-on-surface-dim hover:bg-surface dark:text-surface-base absolute inset-0 mt-200 w-full rounded-xs px-200 text-center"
				@click="handleActionClick"
			>
				{{ t('admin.join') }}
			</Button>
			<InlineSpinner v-if="inProgress" />
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiService';
	import { findPowerLevelsContent, powerLevelOf } from '@hub-client/logic/utils/powerLevelUtils';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{ roomId: string }>();
	const emit = defineEmits<{
		(e: 'close'): void;
	}>();
	const { t } = useI18n();
	const user = useUser();
	const pubhubs = usePubhubsStore();
	const dialog = useDialog();
	const modalHolder = dialog.newId();
	const inProgress = ref<boolean>(false);

	// Reactive state
	const roomCreator = ref<string | undefined>(undefined);

	// Lifecycle hooks
	onMounted(async () => {
		await fetchRoomCreatorInfo();
	});

	onUnmounted(() => {
		dialog.releaseModal(modalHolder);
	});

	// Watchers
	watch(
		() => props.roomId,
		async () => await fetchRoomCreatorInfo(),
	);

	// Methods
	async function fetchRoomCreatorInfo(): Promise<void> {
		// If something goes wrong when fetching it is difficult to pinpoint what went wrong.
		// The end-user would have to notify us if it happens.

		try {
			// Get Room Creator Id
			roomCreator.value = await ManagementUtils.getRoomCreator(props.roomId);

			if (!roomCreator.value) {
				dialog.confirm(t('errors.error'));
				return;
			}

			dialog.holdModal(modalHolder);
		} catch {
			dialog.confirm(t('errors.error'));
			return;
		}
	}

	async function joinAndMakeAdmin(roomId: string): Promise<void> {
		await pubhubs.joinRoom(props.roomId);
		await APIService.makeRoomAdmin(roomId, user.userId ?? '');
	}

	/**
	 * Lets the room creator hand admin over to us: join as them, make us admin, and leave as them again.
	 *
	 */
	async function handOverFromPrevAdmin(prevAdminId: string): Promise<void> {
		const { access_token: prevAdminToken } = await APIService.adminUserLogin(prevAdminId);
		try {
			await APIService.forceRoomJoin(props.roomId, prevAdminToken);
			await joinAndMakeAdmin(props.roomId);
			await APIService.forceRoomLeave(props.roomId, prevAdminToken);
		} finally {
			await APIService.revokeAccessToken(prevAdminToken).catch(() => undefined);
		}
	}

	// Event handlers
	async function handleActionClick(): Promise<void> {
		if (!roomCreator.value) return;
		inProgress.value = true;
		try {
			await handOverFromPrevAdmin(roomCreator.value);
		} catch {
			inProgress.value = false;
			dialog.confirm(t('errors.error'));
			return;
		}
		await completeFlow();
	}

	async function completeFlow() {
		// Start polling for conditions
		let pollInterval: ReturnType<typeof setInterval> | undefined = setInterval(async () => {
			// This Hub is now a room Admin
			const isAdmin = await hasBecomeRoomAdmin(user.userId ?? '');
			// Check if the previous admin is *not* found in the current members, meaning they've left
			const roomMembers = (await APIService.adminGetRoomMembers(props.roomId)).members;
			const hasPrevAdminLeft = !roomCreator.value || !roomMembers.includes(roomCreator.value);

			// For the spinner
			if (isAdmin && hasPrevAdminLeft) {
				inProgress.value = false;
				clearInterval(pollInterval); // Stop polling
				pollInterval = undefined;
				emit('close');
			}
		}, 2000); // Poll every 2 seconds (adjust as needed)
	}

	function close(): void {
		emit('close');
	}

	// Sanity Check to complete the workflow

	async function hasBecomeRoomAdmin(userId: string): Promise<boolean | undefined> {
		// Extract power level event
		const roomState = await APIService.adminGetRoomState(props.roomId);
		const powerLevelsContent = findPowerLevelsContent(roomState.state);
		if (!powerLevelsContent) return undefined;
		return powerLevelOf(powerLevelsContent, userId) === UserPowerLevel.Admin;
	}
</script>
