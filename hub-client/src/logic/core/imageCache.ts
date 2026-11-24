/**
 * Device copies of public hub images (hub icons and banners), so they still show while the hub can't
 * be reached (see docs/app/offline.md). Keyed by address, in this context's own IndexedDB: the app
 * shell and every hub frame each have their own.
 *
 * Only for images anyone can fetch without logging in: entries are not encrypted, unlike HubStorage.
 * There are a few per hub (icon, dark icon, banner), so no eviction is needed.
 *
 * Every operation is best effort: where IndexedDB is missing, blocked or slow, the cache simply has
 * nothing, and images load as they did without it.
 */
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('ImageCache');

const DB_NAME = 'pubhubs-image-cache';
const STORE_NAME = 'images';
// Opening can hang silently where storage is blocked; images must not wait for that.
const OPEN_TIMEOUT_MS = 1_000;

type CachedImage = { type: string; data: ArrayBuffer };

interface ImageCacheBackend {
	get(url: string): Promise<CachedImage | undefined>;
	put(url: string, image: CachedImage): Promise<void>;
	delete(url: string): Promise<void>;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function openIndexedDBBackend(): Promise<ImageCacheBackend> {
	if (!globalThis.indexedDB) throw new Error('IndexedDB is not available');
	const db = await new Promise<IDBDatabase>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('Opening IndexedDB timed out')), OPEN_TIMEOUT_MS);
		const request = indexedDB.open(DB_NAME, 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
		request.onsuccess = () => {
			clearTimeout(timer);
			resolve(request.result);
		};
		request.onerror = () => {
			clearTimeout(timer);
			reject(request.error);
		};
	});
	const store = (mode: IDBTransactionMode) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
	return {
		get: (url) => requestToPromise(store('readonly').get(url)),
		put: async (url, image) => {
			await requestToPromise(store('readwrite').put(image, url));
		},
		delete: async (url) => {
			await requestToPromise(store('readwrite').delete(url));
		},
	};
}

let backend: Promise<ImageCacheBackend | null> | null = null;

function openBackend(): Promise<ImageCacheBackend | null> {
	backend ??= openIndexedDBBackend().catch((error) => {
		logger.warn('Image cache unavailable', { error });
		return null;
	});
	return backend;
}

/** Tests only. */
function setImageCacheBackendForTests(testBackend: ImageCacheBackend | null): void {
	backend = Promise.resolve(testBackend);
}

async function getCachedImage(url: string): Promise<Blob | undefined> {
	try {
		const image = await (await openBackend())?.get(url);
		return image ? new Blob([image.data], { type: image.type }) : undefined;
	} catch (error) {
		logger.warn('Could not read a cached image', { url, error });
		return undefined;
	}
}

async function cacheImage(url: string, blob: Blob): Promise<void> {
	try {
		// Stored as bytes: not every WebView stores Blobs in IndexedDB reliably.
		await (await openBackend())?.put(url, { type: blob.type, data: await blob.arrayBuffer() });
	} catch (error) {
		logger.warn('Could not cache an image', { url, error });
	}
}

async function forgetCachedImage(url: string): Promise<void> {
	try {
		await (await openBackend())?.delete(url);
	} catch {
		// Best effort.
	}
}

export { cacheImage, forgetCachedImage, getCachedImage, setImageCacheBackendForTests, type ImageCacheBackend };
