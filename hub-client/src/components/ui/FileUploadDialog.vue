<template>
	<Dialog :buttons="buttonsOkCancel" @close="close($event)" v-click-outside="close">
		<template #header>
			<div class="text-xl text-black">
				{{ $t('file.upload_file') }}
			</div>
		</template>
		<div v-if="imageTypes.includes(props.file?.type)" class="flex items-center justify-center">
			<img :src="blobURL" class="max-h-96 max-w-full rounded-lg" />
		</div>
		<div class="mt-4 flex justify-center text-black">
			<div class="text-lg text-gray">{{ file.name }} ({{ `${filters.formatBytes(file.size, 2)}` }})</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms } from '@/store/store';
	import filters from '@/core/filters';
	import { buttonsOkCancel } from '@/store/dialog';
	import { fileUpload } from '@/composables/fileUpload';
	import { useI18n } from 'vue-i18n';
	const { allTypes, uploadUrl } = useMatrixFiles();
	const { t } = useI18n();

	const rooms = useRooms();
	const pubhubs = usePubHubs();

	const { imageTypes } = useMatrixFiles();
	const emit = defineEmits(['close']);

	const props = defineProps<{ file: File; blobURL: string }>();

	async function close(action: number = 0) {
		if (action === 1) {
			submit();
		} else {
			emit('close');
		}
	}

	async function submit() {
		// display the component
		const accessToken = pubhubs.Auth.getAccessToken();
		// TODO errorhandling
		if (!accessToken) {
			return;
		}

		const errorMsg = t('errors.file_upload');

		const syntheticEvent = {
			currentTarget: {
				files: [props.file],
			} as HTMLInputElement,
		} as Event;

		fileUpload(errorMsg, accessToken, uploadUrl, allTypes, syntheticEvent, (url) => {
			if (imageTypes.includes(props.file?.type)) {
				pubhubs.addImage(rooms.currentRoomId, url);
			} else {
				pubhubs.addFile(rooms.currentRoomId, props.file as File, url);
			}
			URL.revokeObjectURL(props.blobURL);
			emit('close');
		});
	}
</script>
