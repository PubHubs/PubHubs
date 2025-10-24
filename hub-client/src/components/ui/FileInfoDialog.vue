<template>
	<Dialog class="text-black" :title="'File Information'" :buttons="buttonsCancel" @close="close($event)" width="max-w-full lg:max-w-[40%] min-w-[92.5%] lg:min-w-[22.5%]">
		<p class="mb-4 whitespace-pre-line">{{ $t('roomlibrary.info.name') }} {{ prepData().fileName }}</p>
		<p class="mb-4 whitespace-pre-line">{{ $t('roomlibrary.info.uploaded_by') }} {{ props.user }}</p>
		<p class="mb-4 whitespace-pre-line">{{ $t('roomlibrary.info.uploaded_on') }} {{ props.uploadDate.toDateString() }}</p>
		<p class="mb-4 whitespace-pre-line">{{ $t('roomlibrary.info.type') }} {{ prepData().fileType }}</p>
		<p class="mb-4 whitespace-pre-line">{{ $t('roomlibrary.info.size', [prepData().fileSize]) }}</p>
	</Dialog>
</template>

<script setup lang="ts">
	// Components
	import Dialog from '@hub-client/components/ui/Dialog.vue';

	// Models
	import { TFileMessageEventContent, TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { DialogButtonAction, buttonsCancel } from '@hub-client/stores/dialog';

	const props = defineProps<{
		eventContent: TFileMessageEventContent | TImageMessageEventContent;
		user: string;
		uploadDate: Date;
	}>();

	const emit = defineEmits<{
		close: [];
	}>();

	async function close(returnValue: DialogButtonAction) {
		if (returnValue === 0) {
			emit('close');
		}
	}

	function prepData() {
		const fileName = props.eventContent.filename?.replace(/\.[^/.]+$/, '');
		const fileType = props.eventContent.info.mimetype.replace(/^.+\//, '');
		const fileSize = (props.eventContent.info.size / 1000).toFixed(2);
		return { fileName, fileType, fileSize };
	}
</script>
