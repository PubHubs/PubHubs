<template>
	<div class="mt-2 rounded-md bg-gray-lighter p-2 flex">
		<Icon type="paperclip" class="mr-2"></Icon>
		<a class="text-blue" target="_blank" :href="formUrlfromMxc(message.url)">{{ message.body }}</a>
	</div>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { M_FileMessageEventContent } from '@/types/events';

	const { formUrlfromMxc } = useMatrixFiles();

	const props = defineProps<{ message: M_FileMessageEventContent }>();
</script>
