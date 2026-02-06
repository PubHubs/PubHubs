<template>
	<a v-if="blobUrl?.url" target="_blank" :href="blobUrl.url" :download="filename"><slot></slot></a>
	<span v-else><slot></slot></span>
</template>

<script setup lang="ts">
	// Packages
	import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Stores

	const matrixFiles = useMatrixFiles();

	const props = defineProps<{ url: string; filename: string }>();
	let blobUrl = ref<BlobManager | undefined>(undefined);

	onMounted(async () => {
		await getUrl();
	});

	onBeforeUnmount(() => {
		blobUrl.value?.revoke();
	});

	watch(props, async () => {
		await getUrl();
	});

	async function getUrl() {
		const url = await matrixFiles.getAuthorizedMediaUrl(props.url);
		if (url) {
			blobUrl.value?.revoke();
			blobUrl.value = new BlobManager(url);
		}
		if (!url) {
			console.error('Failed to load the file');
		}
	}
</script>
