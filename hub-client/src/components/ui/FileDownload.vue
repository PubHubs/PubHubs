<template>
	<!-- Web: let the browser do the download. -->
	<a
		v-if="blobUrl?.url && !delegateToGlobalClient"
		:download="filename"
		:href="blobUrl.url"
		target="_blank"
		><slot
	/></a>
	<!-- Native app: a download from this iframe goes nowhere, so ask the global client. -->
	<a
		v-else-if="blobUrl?.url"
		class="cursor-pointer"
		role="button"
		@click="shareFile"
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
	import { requestFileShare, shouldDelegateToGlobalClient } from '@hub-client/logic/core/requestFileShare';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	const props = defineProps<{ url: string; filename: string }>();
	const logger = createLogger('FileDownload');
	const matrixFiles = useMatrixFiles();
	const delegateToGlobalClient = shouldDelegateToGlobalClient();

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

	async function shareFile() {
		const url = blobUrl.value?.url;
		if (!url) return;

		try {
			await requestFileShare(url, props.filename);
		} catch (error) {
			logger.error('Could not pass the file to the global client.', { error });
		}
	}
</script>
