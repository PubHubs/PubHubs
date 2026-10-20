<template>
	<div class="h-full overflow-y-auto">
		<div class="flex min-h-full flex-col items-center justify-center gap-300 p-200 lg:gap-400">
			<VideoCallPermissionDialog
				v-if="permissionState"
				:state="permissionState"
				@close="dismissedFor = permissionState"
			/>

			<H1>{{ t('videocall.prejoin_title') }}</H1>

			<div class="flex w-full max-w-7000 flex-col gap-200 lg:gap-300">
				<VideoCallPreview />

				<div
					v-if="user.userId"
					class="flex min-w-0 flex-wrap items-center justify-center gap-100"
				>
					<span class="text-label-small text-on-surface-dim">{{ t('videocall.appear_as') }}</span>
					<UserDisplayName
						:user-id="user.userId"
						:user-display-name="user.userDisplayName(user.userId)"
					/>
					<RoomBadge
						v-if="currentRoom && !currentRoom.isDirectMessageRoom()"
						:user="user.userId"
						:room-id="currentRoom.roomId"
					/>
				</div>

				<VideoCallDevicePicker />

				<ButtonGroup class="justify-center">
					<Button
						variant="tertiary"
						@click="emit('exit')"
						>{{ t('videocall.exit') }}</Button
					>
					<Button
						variant="primary"
						:disabled="!devicesLoaded"
						@click="emit('join')"
						>{{ t('videocall.join') }}</Button
					>
				</ButtonGroup>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import VideoCallDevicePicker from '@hub-client/components/videocall/VideoCallDevicePicker.vue';
	import VideoCallPermissionDialog from '@hub-client/components/videocall/VideoCallPermissionDialog.vue';
	import VideoCallPreview from '@hub-client/components/videocall/VideoCallPreview.vue';

	// Composables
	import { useVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

	// Models
	import { type TPermissionNotice } from '@hub-client/models/videocall/TDeviceAccess';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const emit = defineEmits<{
		join: [];
		exit: [];
	}>();

	const { t } = useI18n();
	const { access, devicesLoaded, setUpDevices } = useVideoCallDevices();
	const rooms = useRooms();
	const user = useUser();

	const currentRoom = computed(() => rooms.currentRoom);

	// Keyed to the state it dismissed, so waving away "blocked" does not also hide a later
	// "no devices found", while a refresh that changes nothing stays quiet.
	const dismissedFor = ref<TPermissionNotice>();

	const permissionState = computed(() => {
		if (access.value === 'granted' || dismissedFor.value === access.value) return undefined;
		return access.value;
	});

	onMounted(() => void setUpDevices());
</script>
