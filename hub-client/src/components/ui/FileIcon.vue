<template>
	<Icon
		v-if="isImage(filename)"
		type="image-square"
		size="sm"
	/>
	<Icon
		v-else
		type="file"
		size="sm"
	/>
</template>

<script lang="ts" setup>
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	defineProps({
		filename: {
			type: String,
			required: true,
		},
	});

	const { isImage } = useMatrixFiles();
</script>
