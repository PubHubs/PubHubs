<template>
	<div id="filePickerContainer">
		<div v-if="messageInput.state.fileAdded" class="relative flex w-full justify-center border-b-2 border-on-surface-disabled">
			<div class="m-2 mb-2 rounded-lg">
				<div v-if="imageTypes.includes(messageInput.state.fileAdded?.type)" class="flex justify-center">
					<img :src="uri" class="max-h-64 max-w-full rounded-lg" />
				</div>
				<div class="mt-1 flex justify-center">
					<div class="text-on-surface-dim text-label">{{ messageInput.state.fileAdded.name }} ({{ `${filters.formatBytes(messageInput.state.fileAdded.size, 2)}` }})</div>
				</div>
			</div>
			<div class="flex gap-2 pt-3" :class="{ 'flex-col': imageTypes.includes(messageInput.state.fileAdded?.type) }">
				<Icon type="arrows-clockwise" class="cursor-pointer hover:text-accent-secondary" @click="openFile()"></Icon>
				<Icon type="trash" class="cursor-pointer hover:text-accent-error" @click="removeFile()"></Icon>
				<div class="relative flex-grow">
					<div class="absolute" :class="imageTypes.includes(messageInput.state.fileAdded?.type) ? 'bottom-10' : 'bottom-1'">
						<Button v-if="submitButton" size="sm" @click="submit()">{{ $t('file.upload_file') }}</Button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" data-testid="file-input" ref="elFileInput" @change="uploadFileTemporary($event)" @cancel="messageInput.cancelFileUpload()" hidden />
</template>

<script setup lang="ts">
	import { PropType, ref } from 'vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import filters from '@hub-client/logic/core/filters';
	import { useMessageInput } from '@hub-client/logic/messageInput';

	const { allTypes, imageTypes, getTypesAsString } = useMatrixFiles();

	const uri = ref<string>('');
	const elFileInput = ref<HTMLInputElement | null>(null);

	const emit = defineEmits(['submit']);

	const props = defineProps({
		messageInput: {
			type: Object as PropType<ReturnType<typeof useMessageInput>>,
			required: true,
		},
		submitButton: {
			type: Boolean,
			default: false,
		},
	});

	function openFile() {
		elFileInput.value?.click();
	}
	// openFile accessible for parent
	defineExpose({
		openFile,
	});

	function removeFile() {
		props.messageInput.state.fileAdded = null;
	}

	function uploadFileTemporary(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const choosenFile = target.files && target.files[0];
		if (choosenFile) {
			// Once the file has been selected from the filesystem.
			// Set props to be passed to the component.
			props.messageInput.state.fileAdded = choosenFile;
			uri.value = URL.createObjectURL(props.messageInput.state.fileAdded);
			props.messageInput.activateSendButton();
			if (elFileInput.value) {
				elFileInput.value.value = '';
			}
		}
	}

	function submit() {
		emit('submit');
	}
</script>
