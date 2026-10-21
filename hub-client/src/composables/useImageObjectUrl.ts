// Packages
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

// Logic
import { BlobManager } from '@hub-client/logic/core/blobManager';
import { cacheImage, forgetCachedImage, getCachedImage } from '@hub-client/logic/core/imageCache';
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
 * With `cache`, for public images only (see logic/core/imageCache.ts), the last fetched copy is shown
 * right away and kept when the fetch fails for lack of a connection, so the image is there offline.
 * The fetch still runs every time, and replaces the copy.
 *
 * @param getUrl Reactive getter for the image address; reloads whenever it changes.
 * @returns `src` to bind to the element: `undefined` while loading, then a `blob:` URL, or the
 *          original address if it could not be fetched.
 */
const useImageObjectUrl = (getUrl: () => string | undefined, options: { cache?: boolean } = {}) => {
	const objectUrl = ref<BlobManager>();
	const unfetchableUrl = ref<string>();
	// Only the latest load may change what is shown.
	let currentLoad = 0;

	const src = computed(() => objectUrl.value?.url ?? unfetchableUrl.value);

	const show = (blob: Blob) => {
		objectUrl.value?.revoke();
		objectUrl.value = new BlobManager(blob);
	};

	const clear = () => {
		objectUrl.value?.revoke();
		objectUrl.value = undefined;
	};

	const load = async (url: string | undefined) => {
		const thisLoad = ++currentLoad;
		clear();
		unfetchableUrl.value = undefined;

		if (!url) return;

		// Set once the hub has answered: from then on the answer decides what is shown, not the copy.
		let answered = false;
		const cached = options.cache ? getCachedImage(url) : Promise.resolve(undefined);
		void cached.then((blob) => {
			if (blob && thisLoad === currentLoad && !answered && !objectUrl.value) show(blob);
		});

		let response: Response;
		try {
			response = await fetch(url);
		} catch (error) {
			if (thisLoad !== currentLoad) return;
			// No answer: keep showing the copy on this device, if there is one.
			const blob = await cached;
			if (thisLoad !== currentLoad) return;
			if (blob) {
				if (!objectUrl.value) show(blob);
				return;
			}
			unfetchableUrl.value = url;
			logger.error('Could not fetch image, falling back to loading it directly', { url, error });
			return;
		}

		answered = true;
		try {
			if (!response.ok) {
				throw new Error(`responded ${response.status}`);
			}
			const blob = await response.blob();
			if (thisLoad !== currentLoad) return;
			show(blob);
			if (options.cache) void cacheImage(url, blob);
		} catch (error) {
			if (thisLoad !== currentLoad) return;
			// The hub answered, so its image is gone or unusable: the copy is outdated too.
			if (options.cache) void forgetCachedImage(url);
			clear();
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
