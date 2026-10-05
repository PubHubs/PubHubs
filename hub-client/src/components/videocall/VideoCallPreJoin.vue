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
	import VideoCallDevicePicker from '@hub-client/components/videocall/VideoCallDevicePicker.vue';
	import VideoCallPermissionDialog from '@hub-client/components/videocall/VideoCallPermissionDialog.vue';
	import VideoCallPreview from '@hub-client/components/videocall/VideoCallPreview.vue';

	// Composables
	import { useVideoCallDevices } from '@hub-client/composables/useVideoCallDevices';

	// Models
	import { type TPermissionNotice } from '@hub-client/models/videocall/TDeviceAccess';

	const emit = defineEmits<{
		join: [];
		exit: [];
	}>();

	const { t } = useI18n();
	const { access, devicesLoaded, setUpDevices } = useVideoCallDevices();

	// Keyed to the state it dismissed, so waving away "blocked" does not also hide a later
	// "no devices found", while a refresh that changes nothing stays quiet.
	const dismissedFor = ref<TPermissionNotice>();

	const permissionState = computed(() => {
		if (access.value === 'granted' || dismissedFor.value === access.value) return undefined;
		return access.value;
	});

	onMounted(() => void setUpDevices());
</script>
