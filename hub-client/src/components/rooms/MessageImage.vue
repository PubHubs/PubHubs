<template>
	<img :alt="message.body" :src="formUrlfromMxc(message.url)" class="max-w-full h-auto" />
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { M_ImageMessageEventContent } from '@/types/events';

	const { formUrlfromMxc } = useMatrixFiles();

	const props = defineProps<{ message: M_ImageMessageEventContent }>();
</script>
