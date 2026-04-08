<template>
	<Icon
		v-if="isImage(filename)"
		type="image-square"
	/>
	<Icon
		v-else
		type="file"
	/>
</template>

<script lang="ts" setup>
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	defineProps({
		filename: {
			type: String,
			required: true,
		},
	});

	const { isImage } = useMatrixFiles();
</script>
