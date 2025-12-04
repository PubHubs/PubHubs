<template>
	<div class="bg-surface absolute inset-0 z-20 h-full opacity-75"></div>
	<div class="fixed inset-0 z-20 flex items-center justify-center p-4">
		<div class="bg-surface-low relative min-h-[300px] rounded-md border p-8 sm:w-[480px] md:w-[640px]">
			<div class="flex justify-between">
				<h2 class="mx-2 my-2 mt-4 font-bold">{{ t('admin.title_room_join') }}</h2>
				<Icon type="x" @click="close()"></Icon>
			</div>

			<hr class="mx-8 mt-2" />
			<div class="my-2 flex flex-col">
				<span>{{ t('admin.join_warning') }}</span>
				<span class="mt-4">{{ t('admin.refresh_admin_operation') }} </span>
			</div>

			<hr class="mx-8 mt-2" />
			<Button @click="handleActionClick" class="bg-on-surface-variant hover:bg-surface-subtle dark:text-surface-low absolute inset-0 mt-4 w-full rounded-xs px-4 text-center">
				{{ t('admin.join') }}
			</Button>
			<InlineSpinner v-if="inProgress"></InlineSpinner>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventType } from 'matrix-js-sdk';
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import { APIService } from '@hub-client/logic/core/apiHubManagement';

	// Models
	import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const user = useUser();
	const pubhubs = usePubhubsStore();
	const dialog = useDialog();
	const inProgress = ref<boolean>(false);

	const props = defineProps<{ roomId: string }>();
	const emit = defineEmits<{
		(e: 'close'): void;
	}>();

	// Reactive state
	const roomCreator = ref<string | undefined>(undefined);

	// Lifecycle hooks
	onMounted(async () => {
		await fetchRoomCreatorInfo();
	});

	onUnmounted(() => {
		dialog.hideModal();
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

			dialog.showModal();
		} catch (error) {
			dialog.confirm(t('errors.error'));
			return;
		}
	}

	async function joinAndMakeAdmin(roomId: string): Promise<void> {
		await pubhubs.joinRoom(props.roomId);
		await APIService.makeRoomAdmin(roomId, user.userId);
	}

	async function attemptToJoinPrevAdmin(adminId: string): Promise<void> {
		const accessToken = await APIService.adminUserLogin(adminId);
		await APIService.forceRoomJoin(props.roomId, accessToken.access_token);
	}

	async function leavePrevAdmin(roomId: string, prevAdminId: string): Promise<void> {
		const accessToken = await APIService.adminUserLogin(prevAdminId);
		// Temporarily set the token
		pubhubs.client.setAccessToken(accessToken.access_token);
		await pubhubs.client.leave(roomId);
	}

	// Event handlers
	async function handleActionClick(): Promise<void> {
		inProgress.value = true;
		// We have already checked if room creator is there or not.
		await attemptToJoinPrevAdmin(roomCreator.value!);
		await joinAndMakeAdmin(props.roomId);
		await leavePrevAdmin(props.roomId, roomCreator.value!);
		await completeFlow();
	}

	async function completeFlow() {
		// Start polling for conditions
		let pollInterval = setInterval(async () => {
			// This Hub is now a room Admin
			const isAdmin = await hasBecomeRoomAdmin(user.userId);
			// Check if the previous admin is *not* found in the current members, meaning they've left
			const roomMembers = (await APIService.adminGetRoomMembers(props.roomId)).members;
			const hasPrevAdminLeft = !roomMembers.includes(roomCreator.value!);

			// For the spinner
			if (isAdmin && hasPrevAdminLeft) {
				inProgress.value = false;
				clearInterval(pollInterval); // Stop polling
				pollInterval = 0;
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
		const powerLevelsEvent = roomState.state.find((event) => event.type === EventType.RoomPowerLevels);
		if (!powerLevelsEvent) return undefined;
		const userPowerLevel = powerLevelsEvent.content.users || {};
		return userPowerLevel[userId] === 100;
	}
</script>
