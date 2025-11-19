<template>
	<Icon v-if="isImage(filename)" type="image-square"></Icon>
	<Icon v-else type="file"></Icon>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	const { isImage } = useMatrixFiles();

	const props = defineProps({
		filename: {
			type: String,
			required: true,
		},
	});
</script>
