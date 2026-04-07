<template>
	<a
		v-if="blobUrl?.url"
		:download="filename"
		:href="blobUrl.url"
		target="_blank"
		><slot
	/></a>
	<span v-else><slot /></span>
</template>

<script lang="ts" setup>
	// Packages
	import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	const props = defineProps<{ url: string; filename: string }>();
	const logger = createLogger('FileDownload');
	const matrixFiles = useMatrixFiles();

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
			logger.error('Failed to load the file');
		}
	}
</script>
