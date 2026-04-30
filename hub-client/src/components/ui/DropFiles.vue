<template>
	<div
		class="flex min-h-36 w-full cursor-pointer flex-col justify-center border-2 border-dotted max-md:min-h-0 max-md:border-none"
		@drop.prevent="onDroppedFile"
		@click="openBrowse()"
	>
		<template v-if="files.length >= maxNumberToUpload">
			<div class="text-accent-error font-bold md:text-center">
				<Icon
					type="warning"
					class="mr-1 inline-block"
				></Icon
				>{{ $t('file.max_upload_reached') }}
			</div>
		</template>
		<template v-else>
			<div class="text-center max-md:hidden">
				<Icon
					type="upload-simple"
					class="mr-1 inline-block"
				></Icon
				>{{ $t('file.drop_files') }}
			</div>
			<div class="text-md text-center max-md:hidden">{{ $t('common.or') }}</div>
			<Button
				class="mx-auto flex items-center justify-center gap-1 max-md:mx-0 max-md:w-full"
				:title="$t('file.upload_files')"
				><Icon
					type="upload-simple"
					class="md:hidden"
				></Icon>
				<span class="visible md:hidden">{{ $t('file.upload_files') }}</span>
				<span
					v-if="files.length === 0"
					class="max-md:hidden"
					>{{ $t('file.select_files') }}</span
				>
				<span
					v-else
					class="max-md:hidden"
					>{{ $t('file.add_files') }}</span
				>
			</Button>
		</template>
		<input
			id="library-file-input"
			ref="fileInput"
			type="file"
			data-testid="library-file-input"
			multiple
			hidden
			@change="browseFiles($event)"
		/>
	</div>
	<div
		v-if="uploadError"
		class="bg-accent-error mt-2 mb-2 inline-block w-full rounded-lg p-2 text-center text-white"
	>
		<Icon
			type="warning"
			class="mr-1 inline-block"
		></Icon
		>{{ $t('file.upload_error') }}
	</div>
	<div
		v-if="files.length > 0"
		class="mt-2 mb-2 flex flex-wrap gap-2"
		data-testid="file-list-buttons"
	>
		<div>
			<Button
				size="sm"
				:disabled="uploadIsActive"
				@click="uploadFiles()"
				>{{ $t('file.start_upload') }}</Button
			>
		</div>
		<div class="grow"></div>
		<div>
			<IconButton
				type="trash"
				class="bg-accent-red! cursor-pointer"
				size="lg"
				@click="cancelFiles()"
			></IconButton>
		</div>
	</div>
	<BarList
		v-if="files.length > 0"
		class="mt-2"
		data-testid="file-list"
	>
		<BarListItem
			v-for="file in files"
			:key="file.name"
		>
			<div class="mb-1 flex h-6 items-center gap-2">
				<div><FileIcon :filename="file.name"></FileIcon></div>
				<div class="grow truncate">{{ file.name }}</div>
				<div class="text-nowrap">{{ filters.formatBytes(file.size, 2) }}</div>
				<div>
					<Icon
						v-if="file.status !== 2"
						type="trash"
						class="cursor-pointer"
						@click.stop="removeFileFromList(file.name)"
					></Icon>
					<Icon
						v-else
						type="check-circle"
						class="text-accent-lime"
					></Icon>
				</div>
			</div>
			<ProgressBar
				:percentage="file.progress"
				class="max-h-1"
				:color="file.status == 2 ? 'bg-accent-lime' : 'bg-accent-primary'"
			></ProgressBar>
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
	import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';

	import { type ExtendedFile, asyncFileUpload, generateUniqueName } from '@hub-client/composables/fileUpload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import filters from '@hub-client/logic/core/filters';

	import { SystemDefaults } from '@hub-client/models/constants';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	const props = withDefaults(
		defineProps<{
			maxNumberOfFiles: number;
			currentFileNames: string[];
		}>(),
		{
			maxNumberOfFiles: SystemDefaults.MaxNumberFileUploads,
			currentFileNames: () => [] as string[],
		},
	);

	const emit = defineEmits(['update']);

	const { uploadUrl } = useMatrixFiles();

	const pubhubs = usePubhubsStore();

	const rooms = useRooms();

	const events = ['dragenter', 'dragover', 'dragleave', 'drop'];

	const fileInput = ref<HTMLInputElement | null>(null);

	const files = ref([] as Array<ExtendedFile>);
	const uploadError = ref(false);
	const uploadIsActive = ref(false);

	const maxNumberToUpload = computed(() => {
		return props.maxNumberOfFiles - props.currentFileNames.length;
	});

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

	onBeforeUnmount(() => {
		files.value.forEach((file) => {
			file.blobManager?.revoke();
		});
	});

	watch(
		() => files.value.length,
		(newlength: number) => {
			if (newlength === 0) {
				emit('update');
			}
		},
	);

	const preventDefaults = (e: Event) => {
		e.preventDefault();
	};

	const openBrowse = () => {
		if (fileInput.value) {
			fileInput.value.value = ''; // Reset value so fileInput keeps working
			fileInput.value?.click();
		}
	};

	const browseFiles = (e: Event) => {
		const files = (e.target as HTMLInputElement).files;
		if (files) addFiles(files);
	};

	const onDroppedFile = (e: DragEvent) => {
		if (e.dataTransfer) addFiles(e.dataTransfer.files);
	};

	const addFiles = (newFiles: FileList) => {
		uploadError.value = false;
		for (let i = 0; i < newFiles.length; i++) {
			if (files.value.length >= maxNumberToUpload.value) {
				break;
			}
			const file = newFiles[i] as ExtendedFile;
			// prevent double files
			if (!files.value.find((existing) => file.name === existing.name)) {
				file.status = FileReader.EMPTY;
				file.progress = 0;
				file.blobManager = new BlobManager(file);
				files.value.push(file);
			}
		}
	};

	const removeFileFromList = (name: string) => {
		const index = files.value.findIndex((x) => x.name === name);
		if (index === -1) return;

		const file = files.value[index];
		file.blobManager?.revoke();
		files.value.splice(index, 1);
	};

	const cancelFiles = () => {
		files.value.forEach((file) => {
			file.blobManager?.revoke();
		});
		files.value = [];
		uploadError.value = false;
	};

	const uploadFiles = async () => {
		uploadError.value = false;
		uploadIsActive.value = true;

		for (const file of files.value) {
			const fileName = generateUniqueName(file.name, (name) => props.currentFileNames.includes(name));

			file.status = FileReader.LOADING;
			file.progress = 0;

			await new Promise<void>((resolve) => {
				asyncFileUpload(
					pubhubs.Auth.getAccessToken() as string,
					uploadUrl,
					file,

					// Progress callback
					(progress: ProgressEvent) => {
						const updatedIndex = files.value.findIndex((x) => x.name === file.name);
						if (updatedIndex !== -1) {
							files.value[updatedIndex].progress = (progress.loaded / progress.total) * 100;
							files.value = [...files.value]; // force array-level change for vue to display the progress
						}
					},

					// Ready callback
					async (uri: string) => {
						file.progress = 100;

						const success = await pubhubs.addFile(rooms.currentRoomId, undefined, fileName, file, uri, '', PubHubsMgType.LibraryFileMessage);

						if (success) {
							file.status = FileReader.DONE;
							// Revoke server URI
							file.blobManager?.revoke();
						} else {
							file.progress = 0;
							file.status = FileReader.EMPTY;
							uploadError.value = true;
						}
						resolve();
					},
				);
			});
			files.value = files.value.filter((x) => x.status !== FileReader.DONE);
		}
		uploadIsActive.value = false;
	};
</script>
