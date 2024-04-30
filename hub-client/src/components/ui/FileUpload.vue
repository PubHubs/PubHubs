<template>
	<Dialog :buttons="buttonsOkCancel" width="w-1/3" @close="close($event)">
		<template #header>
			<div class="text-black text-xl">
				{{ $t('file.upload_file') }}
			</div>
		</template>
		<div v-if="imageTypes.includes(props.file?.type)" class="flex items-center justify-center">
			<img :src="formUrlfromMxc(mxcPath)" class="max-w-full max-h-96 rounded-lg" />
		</div>
		<div class="text-black flex justify-center mt-4">
			<div class="text-lg text-gray">{{ file.name }} ({{ `${filters.formatBytes(file.size)}` }})</div>
		</div>
	</Dialog>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useRooms } from '@/store/store';
	import filters from '@/core/filters';
	import { buttonsOkCancel } from '@/store/dialog';

	const rooms = useRooms();
	const pubhubs = usePubHubs();

	const { imageTypes, formUrlfromMxc } = useMatrixFiles();
	const emit = defineEmits(['close']);

	const props = defineProps<{ file: Record<string, any>; mxcPath: string }>();

	async function close(action: number = 0) {
		if (action == 1) {
			submit();
		} else {
			emit('close');
		}
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
