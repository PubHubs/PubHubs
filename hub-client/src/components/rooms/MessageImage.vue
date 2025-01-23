<template>
	<img v-bind="$attrs" :alt="message.body" :src="formUrlfromMxc(message.url)" class="object-contain cursor-pointer" @click.stop="showFullImage = true" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="w-[100vw] h-[100vh] top-0 left-0 fixed z-50 flex" :show-closing-cross="true">
		<img :alt="message.body" :src="formUrlfromMxc(message.url)" class="h-4/5 w-4/5 m-auto object-contain" />
	</Popover>
</template>

<script setup lang="ts">
	// Components
	import Popover from '../ui/Popover.vue';

	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { TImageMessageEventContent } from '@/model/events/TMessageEvent';
	import { ref } from 'vue';

	const { formUrlfromMxc } = useMatrixFiles();

	const showFullImage = ref(false);

	const props = defineProps<{ message: TImageMessageEventContent }>();
</script>
