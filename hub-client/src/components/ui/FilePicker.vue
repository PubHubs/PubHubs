<template>
	<div id="filePickerContainer">
		<div
			v-if="messageInput.state.fileAdded"
			class="border-on-surface-disabled relative flex w-full justify-center border-b-2"
		>
			<div class="m-2 mb-2 rounded-lg">
				<div
					v-if="imageTypes.includes(messageInput.state.fileAdded?.type)"
					class="flex justify-center"
				>
					<img
						:src="uri?.url ?? ''"
						class="max-h-64 max-w-full rounded-lg"
					/>
				</div>
				<div class="mt-1 flex justify-center">
					<div class="text-on-surface-dim text-label">
						{{ messageInput.state.fileAdded.name }} ({{ `${filters.formatBytes(messageInput.state.fileAdded.size, 2)}` }})
					</div>
				</div>
			</div>
			<div
				class="flex gap-2 pt-3"
				:class="{ 'flex-col': imageTypes.includes(messageInput.state.fileAdded?.type) }"
			>
				<Icon
					type="arrows-clockwise"
					class="hover:text-accent-secondary cursor-pointer"
					@click.stop="openFile"
				></Icon>
				<Icon
					type="trash"
					class="hover:text-accent-error cursor-pointer"
					@click="removeFile()"
				></Icon>
			</div>
		</div>
	</div>

	<input
		ref="elFileInput"
		type="file"
		:accept="getTypesAsString(allTypes)"
		class="attach-file"
		data-testid="file-input"
		hidden
		@change="uploadFileTemporary($event)"
		@cancel="messageInput.cancelFileUpload()"
	/>
</template>

<script setup lang="ts">
	import { type PropType, onBeforeUnmount, ref, watch } from 'vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import filters from '@hub-client/logic/core/filters';
	import { type useMessageInput } from '@hub-client/logic/messageInput';

	const props = defineProps({
		messageInput: {
			type: Object as PropType<ReturnType<typeof useMessageInput>>,
			required: true,
		},
		uploadOwnershipTransferred: {
			type: Boolean,
			default: false,
		},
		submitButton: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits<{
		uploadFile: [blobManager: BlobManager | undefined];
	}>();

	const { allTypes, imageTypes, getTypesAsString } = useMatrixFiles();

	const uri = ref<BlobManager>();
	const elFileInput = ref<HTMLInputElement | null>(null);

	// FilePicker starts as owner of the blob URL and can transfer ownership to parent.
	const ownsBlobMemory = ref(true);

	watch(
		() => props.uploadOwnershipTransferred,
		(transferred) => {
			if (transferred) {
				ownsBlobMemory.value = false;
			}
		},
	);

	onBeforeUnmount(() => {
		if (ownsBlobMemory.value) {
			uri.value?.revoke();
		}
	});

	function openFile() {
		elFileInput.value?.click();
	}

	// openFile accessible for parent
	defineExpose({
		openFile,
	});

	function removeFile() {
		if (ownsBlobMemory.value) {
			uri.value?.revoke();
		}
		props.messageInput.setFileAdded(null);
		emit('uploadFile', undefined);
	}

	function uploadFileTemporary(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const choosenFile = target.files && target.files[0];
		if (choosenFile) {
			// Revoke previous URL only if FilePicker still owns it.
			if (ownsBlobMemory.value) {
				uri.value?.revoke();
			}
			// Once the file has been selected from the filesystem.
			// Set props to be passed to the component.
			props.messageInput.setFileAdded(choosenFile);
			uri.value = new BlobManager(choosenFile);
			ownsBlobMemory.value = true;
			props.messageInput.activateSendButton();
			if (elFileInput.value) {
				elFileInput.value.value = '';
			}
		}
		emit('uploadFile', uri.value);
	}
</script>
