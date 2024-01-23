<template>
	<Dialog :buttons="buttonsOkCancel" width="w-1/3" @close="close()" @accept="submit()">
		<template #header>
			<div class="text-black text-xl">
				{{ $t('file.upload_file') }}
			</div>
		</template>
		<div v-if="imageTypes.includes(props.file?.type)" class="flex items-center justify-center">
			<img :alt="image" :src="formUrlfromMxc(mxcPath)" class="max-w-full h-auto rounded-lg" />
		</div>
		<div class="text-black flex-col">
			<div class="text-lg text-gray">{{ file.name }} ({{ `${filters.formatBytes(file.size)}` }})</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms } from '@/store/store';
	import Dialog from './Dialog.vue';
	import filters from '@/core/filters';
	const rooms = useRooms();
	const pubhubs = usePubHubs();

	const { imageTypes, formUrlfromMxc } = useMatrixFiles();
	const emit = defineEmits(['close']);

	const props = defineProps({
		file: {
			type: Object,
		},
		mxcPath: {
			type: String,
		},
	});

	async function close() {
		emit('close');
	}

	async function submit() {
		if (imageTypes.includes(props.file?.type)) {
			pubhubs.addImage(rooms.currentRoomId, props.mxcPath);
		} else {
			pubhubs.addFile(rooms.currentRoomId, props.file, props.mxcPath);
		}

		close();
	}
</script>
