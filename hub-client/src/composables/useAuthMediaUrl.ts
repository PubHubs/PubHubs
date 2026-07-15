// Packages
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Logic
import { BlobManager } from '@hub-client/logic/core/blobManager';
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('useAuthMediaUrl');

export function useAuthMediaUrl(getUrl: () => string | undefined) {
	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<BlobManager>();

	async function load(mxcUrl: string | undefined) {
		authMediaUrl.value?.revoke();
		if (!mxcUrl) return;
		try {
			const url = await matrixFiles.getAuthorizedMediaUrl(mxcUrl);
			authMediaUrl.value = new BlobManager(url);
		} catch (error) {
			logger.error('Failed to load authorized media', { url: mxcUrl, error });
		}
	}

	onMounted(() => load(getUrl()));
	watch(getUrl, (newUrl) => load(newUrl));
	onBeforeUnmount(() => authMediaUrl.value?.revoke());

	return { authMediaUrl };
}
