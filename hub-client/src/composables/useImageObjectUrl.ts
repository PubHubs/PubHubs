// Packages
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Logic
import { BlobManager } from '@hub-client/logic/core/blobManager';
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('useImageObjectUrl');

/**
 * Loads an image over `fetch()` and exposes it as an object URL, for images whose address is
 * cross-origin and plain HTTP in development.
 *
 * Chromium auto-upgrades a *passive* subresource — `<img src="http://...">` — from `http:` to
 * `https:` while keeping the port as-is. In the Capacitor shell the app's own origin is
 * `https://pubhubs-app.invalid` (`androidScheme: 'https'` in capacitor.config.ts), so a hub's
 * plain-HTTP dev address gets upgraded onto the plain-HTTP Synapse port as https and the handshake
 * fails. mki
 *
 * `fetch()` is not auto-upgraded — the WebView's relaxed mixed-content mode (debug builds only, see
 * MainActivity.java) does cover it — so pulling the bytes over fetch and handing the element a
 * `blob:` URL leaves no mixed content to upgrade.
 *
 * @param getUrl Reactive getter for the image address; reloads whenever it changes.
 * @returns `src` to bind to the element: `undefined` while loading, then a `blob:` URL, or the
 *          original address if it could not be fetched.
 */
const useImageObjectUrl = (getUrl: () => string | undefined) => {
	const objectUrl = ref<BlobManager>();
	const unfetchableUrl = ref<string>();

	const src = computed(() => objectUrl.value?.url ?? unfetchableUrl.value);

	const load = async (url: string | undefined) => {
		objectUrl.value?.revoke();
		objectUrl.value = undefined;
		unfetchableUrl.value = undefined;

		if (!url) return;

		try {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`responded ${response.status}`);
			}
			objectUrl.value = new BlobManager(await response.blob());
		} catch (error) {
			unfetchableUrl.value = url;
			logger.error('Could not fetch image, falling back to loading it directly', { url, error });
		}
	};

	onMounted(() => load(getUrl()));
	watch(getUrl, (newUrl) => load(newUrl));
	onBeforeUnmount(() => objectUrl.value?.revoke());

	return { src };
};

export { useImageObjectUrl };
