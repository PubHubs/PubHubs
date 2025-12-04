<template>
	<div class="flex min-h-36 w-full cursor-pointer flex-col justify-center border-2 border-dotted max-md:min-h-0 max-md:border-none" @drop.prevent="onDroppedFile" @click="openBrowse()">
		<template v-if="maxNumerOfFilesReached">
			<div class="text-accent-error font-bold md:text-center"><Icon type="warning" class="mr-1 inline-block"></Icon>{{ $t('file.max_upload_reached') }}</div>
		</template>
		<template v-else>
			<div class="text-center max-md:hidden"><Icon type="upload-simple" class="mr-1 inline-block"></Icon>{{ $t('file.drop_files') }}</div>
			<div class="text-md text-center max-md:hidden">{{ $t('common.or') }}</div>
			<Button class="mx-auto flex items-center justify-center gap-1 max-md:mx-0 max-md:w-full" :title="$t('file.upload_files')"
				><Icon type="upload-simple" class="md:hidden"></Icon>
				<span class="visible md:hidden">{{ $t('file.upload_files') }}</span>
				<span v-if="files.length === 0" class="max-md:hidden">{{ $t('file.select_files') }}</span>
				<span v-else class="max-md:hidden">{{ $t('file.add_files') }}</span>
			</Button>
		</template>
		<input ref="fileInput" type="file" id="library-file-input" data-testid="library-file-input" multiple @change="browseFiles($event)" hidden />
	</div>
	<div v-if="uploadError" class="bg-accent-error mt-2 mb-2 inline-block w-full rounded-lg p-2 text-center text-white"><Icon type="warning" class="mr-1 inline-block"></Icon>{{ $t('file.upload_error') }}</div>
	<div v-if="files.length > 0" class="mt-2 mb-2 flex flex-wrap gap-2" data-testid="file-list-buttons">
		<div>
			<Button size="sm" @click="uploadFiles()">{{ $t('file.start_upload') }}</Button>
		</div>
		<div class="flex-grow"></div>
		<div>
			<IconButton type="trash" class="bg-accent-red! cursor-pointer" size="lg" @click="cancelFiles()"></IconButton>
		</div>
	</div>
	<BarList v-if="files.length > 0" class="mt-2" data-testid="file-list">
		<BarListItem v-for="(file, index) in files">
			<div class="mb-1 flex h-6 items-center gap-2">
				<div><FileIcon :filename="file.name"></FileIcon></div>
				<div class="flex-grow truncate">{{ file.name }}</div>
				<div class="text-nowrap">{{ filters.formatBytes(file.size, 2) }}</div>
				<div>
					<Icon v-if="file.status !== 2" type="trash" class="cursor-pointer" @click.stop="removeFileFromList(index)"></Icon>
					<Icon v-else type="check-circle" class="text-accent-lime"></Icon>
				</div>
			</div>
			<ProgressBar :percentage="file.progress" class="max-h-1" :color="file.status == 2 ? 'bg-accent-lime' : 'bg-accent-primary'"></ProgressBar>
		</BarListItem>
	</BarList>
</template>

<script setup lang="ts">
	import Button from '../elements/Button.vue';
	import Icon from '../elements/Icon.vue';
	import IconButton from '../elements/IconButton.vue';
	import BarList from './BarList.vue';
	import BarListItem from './BarListItem.vue';
	import ProgressBar from './ProgressBar.vue';
	import { computed, onMounted, onUnmounted, ref } from 'vue';

	import { ExtendedFile, asyncFileUpload } from '@hub-client/composables/fileUpload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';

	import { SystemDefaults } from '@hub-client/models/constants';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	const { uploadUrl } = useMatrixFiles();

	const pubhubs = usePubhubsStore();
	const rooms = useRooms();

	const emit = defineEmits(['update']);
	const events = ['dragenter', 'dragover', 'dragleave', 'drop'];

	const fileInput = ref<HTMLInputElement | null>(null);

	const files = ref([] as Array<ExtendedFile>);
	const uploadError = ref(false);

	onMounted(() => {
		events.forEach((eventName) => {
			document.body.addEventListener(eventName, preventDefaults);
		});
	});

	onUnmounted(() => {
		events.forEach((eventName) => {
			document.body.removeEventListener(eventName, preventDefaults);
		});
	});

	const preventDefaults = (e) => {
		e.preventDefault();
	};

	const openBrowse = () => {
		fileInput.value?.click();
	};

	const browseFiles = (e) => {
		addFiles(e.target.files);
	};

	const onDroppedFile = (e) => {
		addFiles(e.dataTransfer.files);
	};

	const addFiles = (newFiles: string | any[]) => {
		uploadError.value = false;
		for (let i = 0; i < newFiles.length; i++) {
			if (files.value.length >= SystemDefaults.MaxNumberFileUploads) {
				break;
			}
			const file = newFiles[i];
			// prevent double files
			if (!files.value.find((existing) => file.name === existing.name)) {
				file.status = FileReader.EMPTY;
				file.progress = 0;
				files.value.push(file);
			}
		}
	};

	const removeFileFromList = (index: number) => {
		files.value.splice(index, 1);
	};

	const removeFileFromListByFile = (file: File) => {
		const index = files.value.findIndex((f) => f.name === file.name);
		removeFileFromList(index);
	};

	const cancelFiles = () => {
		files.value = [];
		uploadError.value = false;
	};

	const uploadFiles = async () => {
		uploadError.value = false;
		const tmpFiles = [...files.value];
		checkEmptyList();
		for (let i = 0; i < tmpFiles.length; i++) {
			const file = tmpFiles[i];
			file.status = FileReader.LOADING;
			file.progress = 0;
			files.value = tmpFiles;

			asyncFileUpload(
				pubhubs.Auth.getAccessToken() as string,
				uploadUrl,
				file,
				(progress: any) => {
					const tmpFiles = [...files.value];
					const tmpFile = tmpFiles[i];
					tmpFile.progress = (progress.loaded / progress.total) * 100;
					files.value = tmpFiles;
				},
				async (uri: string) => {
					const tmpFiles = [...files.value];
					const tmpFile = tmpFiles[i];
					tmpFile.progress = 100;
					tmpFile.status = FileReader.DONE;
					const success = await pubhubs.addFile(rooms.currentRoomId, undefined, file, uri, '', PubHubsMgType.LibraryFileMessage);
					if (success) {
						URL.revokeObjectURL(uri);
						setTimeout(() => {
							removeFileFromListByFile(file);
						}, 500);
					} else {
						tmpFile.progress = 0;
						tmpFile.status = FileReader.EMPTY;
						uploadError.value = true;
					}
					files.value = tmpFiles;
				},
			);
		}
	};

	const checkEmptyList = () => {
		const emptyListTimer = setInterval(() => {
			if (files.value.length === 0) {
				emit('update');
				clearInterval(emptyListTimer);
			}
		}, 100);
	};

	const maxNumerOfFilesReached = computed(() => {
		return files.value.length >= SystemDefaults.MaxNumberFileUploads;
	});
</script>
