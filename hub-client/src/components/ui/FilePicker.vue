<template>
	<div id="filePickerContainer">
		<div
			v-if="messageInput.state.fileAdded"
			class="overflow-hidden"
		>
			<div class="rounded-t-base bg-accent-blue/10 border-accent-blue flex h-500 items-center justify-between gap-100 border-b px-200">
				<div class="flex min-w-0 items-center gap-100">
					<Icon
						class="text-accent-blue shrink-0"
						size="sm"
						type="file"
					/>
					<span class="text-accent-blue text-label-small shrink-0">{{ $t('file.upload_file') }}</span>
					<span class="text-on-surface-dim text-label-small truncate">
						{{ messageInput.state.fileAdded.name }} ({{ filters.formatBytes(messageInput.state.fileAdded.size, 2) }})
					</span>
				</div>
				<div class="flex items-center gap-100">
					<Icon
						type="arrows-clockwise"
						class="text-accent-blue shrink-0 hover:cursor-pointer"
						size="sm"
						@click.stop="openFile"
					/>
					<button
						class="shrink-0 hover:cursor-pointer"
						@click="removeFile()"
					>
						<Icon
							class="text-accent-blue"
							size="sm"
							type="x"
						/>
					</button>
				</div>
			</div>
			<div
				v-if="imageTypes.includes(messageInput.state.fileAdded?.type)"
				class="flex justify-center px-200 pt-100 pb-200"
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
	</div>
</template>

<script setup lang="ts">
	import { type PropType, onBeforeUnmount, ref, watch } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

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

	watch(
		() => props.messageInput.state.fileAdded,
		(file) => {
			if (file && !uri.value?.url) {
				if (ownsBlobMemory.value) {
					uri.value?.revoke();
				}
				uri.value = new BlobManager(file);
				ownsBlobMemory.value = true;
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
