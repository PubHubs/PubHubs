<template>
	<div id="filePickerContainer">
		<div v-if="messageInput.fileAdded" class="relative flex w-full justify-center border-b-2 border-on-surface-disabled">
			<div class="m-2 mb-2 rounded-lg">
				<div v-if="imageTypes.includes(messageInput.fileAdded?.type)" class="flex justify-center">
					<img :src="uri" class="max-h-64 max-w-full rounded-lg" />
				</div>
				<div class="mt-1 flex justify-center">
					<div class="text-on-surface-dim ~text-label-min/label-max">{{ messageInput.fileAdded.name }} ({{ `${filters.formatBytes(messageInput.fileAdded.size, 2)}` }})</div>
				</div>
			</div>
			<div class="flex gap-2 pt-2" :class="{ 'flex-col': imageTypes.includes(messageInput.fileAdded?.type) }">
				<Icon type="swap" class="cursor-pointer hover:text-accent-secondary" @click="openFile()"></Icon>
				<Icon type="bin" class="cursor-pointer hover:text-accent-error" @click="removeFile()"></Icon>
			</div>
		</div>
	</div>

	<input type="file" :accept="getTypesAsString(allTypes)" class="attach-file" ref="elFileInput" @change="uploadFile($event)" @cancel="messageInput.cancelFileUpload()" hidden />
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import filters from '@/logic/core/filters';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { useMessageInput } from '@/logic/store/messageInput';

	const { allTypes, imageTypes, getTypesAsString } = useMatrixFiles();
	const messageInput = useMessageInput();

	const uri = ref<string>('');
	const elFileInput = ref<HTMLInputElement | null>(null);

	function openFile() {
		elFileInput.value?.click();
	}
	// openFile accessible for parent
	defineExpose({
		openFile,
	});

	function removeFile() {
		messageInput.fileAdded = null;
	}

	function uploadFile(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const choosenFile = target.files && target.files[0];
		if (choosenFile) {
			// Once the file has been selected from the filesystem.
			// Set props to be passed to the component.
			messageInput.fileAdded = choosenFile;
			uri.value = URL.createObjectURL(messageInput.fileAdded);
			messageInput.activateSendButton();
			if (elFileInput.value) {
				elFileInput.value.value = '';
			}
		}
	}
</script>
