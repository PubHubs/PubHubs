<template>
	<Dialog :buttons="buttonsOkCancel" @close="close($event)" v-click-outside="close">
		<template #header>
			<div class="">
				{{ $t('file.upload_file') }}
			</div>
		</template>
		<div v-if="isImage" class="flex items-center justify-center">
			<img :src="blobURL" class="max-h-96 max-w-full rounded-lg" />
		</div>
		<div class="mt-4 flex justify-center">
			<div class="text-on-surface-dim ~text-label-min/label-max">{{ file.name }} ({{ `${filters.formatBytes(file.size, 2)}` }})</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { MsgType } from 'matrix-js-sdk';
	import { computed } from 'vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import filters from '@hub-client/logic/core/filters';

	import { TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

	import { buttonsOkCancel } from '@hub-client/stores/dialog';

	const { imageTypes } = useMatrixFiles();
	const emit = defineEmits(['close', 'submit']);

	const props = defineProps({
		file: {
			type: File,
			required: true,
		},
		blobURL: {
			type: String,
			required: true,
		},
		threadId: {
			type: String,
		},
	});

	const isImage = computed(() => imageTypes.includes(props.file?.type));

	async function close(action: number = 0) {
		if (action === 1) {
			let obj: TLocalAttachmentMessageEventContent;
			if (isImage.value) {
				obj = {
					msgtype: MsgType.Image,
					file: props.file,
					blobURL: props.blobURL,
				};
			} else {
				obj = {
					msgtype: MsgType.File,
					file: props.file,
					blobURL: props.blobURL,
				};
			}
			emit('submit', obj);
			emit('close');
		} else {
			emit('close');
		}
	}

	// async function submit() {
	// 	// display the component
	// 	const accessToken = pubhubs.Auth.getAccessToken();
	// 	// TODO errorhandling
	// 	if (!accessToken) {
	// 		return;
	// 	}
	//
	// 	const errorMsg = t('errors.file_upload');
	//
	// 	const syntheticEvent = {
	// 		currentTarget: {
	// 			files: [props.file],
	// 		},
	// 	} as unknown as Event;
	//
	// 	fileUpload(errorMsg, accessToken, uploadUrl, allTypes, syntheticEvent, (url) => {
	// 		if (imageTypes.includes(props.file?.type)) {
	// 			pubhubs.addImage(rooms.currentRoomId, props.threadId, url);
	// 		} else {
	// 			pubhubs.addFile(rooms.currentRoomId, props.threadId, props.file as File, url);
	// 		}
	// 		URL.revokeObjectURL(props.blobURL);
	// 		emit('close');
	// 	});
	// }
</script>
