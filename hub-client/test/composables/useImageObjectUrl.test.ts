// Packages
import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

// Composables
import { useImageObjectUrl } from '@hub-client/composables/useImageObjectUrl';

import { type ImageCacheBackend, setImageCacheBackendForTests } from '@hub-client/logic/core/imageCache';

const ICON_URL = 'http://hub.test:8008/_synapse/client/hub/icon';

// jsdom implements neither, and BlobManager needs both.
const createObjectURL = vi.fn(() => 'blob:hub-media');
const revokeObjectURL = vi.fn();

/**
 * Mounts a host component so the composable's onMounted/onBeforeUnmount hooks actually run, and
 * exposes what it returned.
 */
const mountWith = (getUrl: () => string | undefined, options?: { cache?: boolean }) => {
	let composable: ReturnType<typeof useImageObjectUrl>;

	const wrapper = mount(
		defineComponent({
			setup() {
				composable = useImageObjectUrl(getUrl, options);
				return () => h('div');
			},
		}),
	);

	return { wrapper, composable: composable! };
};

/** Lets the mount's fetch and its `await response.blob()` both settle. */
const settle = async () => {
	await nextTick();
	await nextTick();
};

describe('useImageObjectUrl', () => {
	beforeEach(() => {
		URL.createObjectURL = createObjectURL;
		URL.revokeObjectURL = revokeObjectURL;
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	test('fetches the image and exposes it as an object URL', async () => {
		const blob = new Blob(['png'], { type: 'image/png' });
		vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, blob: async () => blob } as Response);

		const { composable } = mountWith(() => ICON_URL);
		await settle();

		expect(fetch).toHaveBeenCalledWith(ICON_URL);
		expect(createObjectURL).toHaveBeenCalledWith(blob);
		expect(composable.src.value).toBe('blob:hub-media');
	});

	test('has no src while the fetch is still in flight, so callers do not flash a placeholder', () => {
		vi.mocked(fetch).mockReturnValue(new Promise(() => {}));

		const { composable } = mountWith(() => ICON_URL);

		expect(composable.src.value).toBeUndefined();
	});

	test('does not fetch when there is no url', async () => {
		const { composable } = mountWith(() => undefined);
		await settle();

		expect(fetch).not.toHaveBeenCalled();
		expect(composable.src.value).toBeUndefined();
	});

	// Hubs are upgraded independently of the clients, so one still serving these without
	// Access-Control-Allow-Origin must not lose its icon in contexts where <img> alone worked.
	test('falls back to the address itself when the fetch is unreadable', async () => {
		vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

		const { composable } = mountWith(() => ICON_URL);
		await settle();

		expect(composable.src.value).toBe(ICON_URL);
	});

	test('falls back to the address itself on a non-ok response', async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob() } as Response);

		const { composable } = mountWith(() => ICON_URL);
		await settle();

		expect(createObjectURL).not.toHaveBeenCalled();
		expect(composable.src.value).toBe(ICON_URL);
	});

	test('revokes the object URL on unmount, so the blob is not leaked', async () => {
		vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob() } as Response);

		const { wrapper, composable } = mountWith(() => ICON_URL);
		await settle();
		expect(composable.src.value).toBe('blob:hub-media');

		wrapper.unmount();

		expect(revokeObjectURL).toHaveBeenCalledWith('blob:hub-media');
	});

	describe('with the device cache', () => {
		let entries: Map<string, { type: string; data: ArrayBuffer }>;

		const cachedText = async () => {
			const entry = entries.get(ICON_URL);
			return entry ? new TextDecoder().decode(entry.data) : undefined;
		};
		const blobText = async (index: number) => await (createObjectURL.mock.calls[index] as unknown as [Blob])[0].text();

		beforeEach(() => {
			entries = new Map();
			const memory: ImageCacheBackend = {
				get: async (url) => entries.get(url),
				put: async (url, image) => void entries.set(url, image),
				delete: async (url) => void entries.delete(url),
			};
			setImageCacheBackendForTests(memory);
		});

		afterEach(() => {
			setImageCacheBackendForTests(null);
		});

		test('keeps a copy of a fetched image', async () => {
			vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['fresh'], { type: 'image/png' }) } as Response);

			mountWith(() => ICON_URL, { cache: true });

			await vi.waitFor(async () => expect(await cachedText()).toBe('fresh'));
			expect(entries.get(ICON_URL)?.type).toBe('image/png');
		});

		test('shows the copy when the hub cannot be reached', async () => {
			entries.set(ICON_URL, { type: 'image/png', data: new TextEncoder().encode('saved').buffer as ArrayBuffer });
			vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

			const { composable } = mountWith(() => ICON_URL, { cache: true });

			await vi.waitFor(() => expect(composable.src.value).toBe('blob:hub-media'));
			expect(await blobText(0)).toBe('saved');
			expect(entries.has(ICON_URL)).toBe(true);
		});

		test('shows the copy while fetching, then the fetched image', async () => {
			entries.set(ICON_URL, { type: 'image/png', data: new TextEncoder().encode('saved').buffer as ArrayBuffer });
			let respond!: (response: Response) => void;
			vi.mocked(fetch).mockReturnValue(new Promise((resolve) => (respond = resolve)));

			const { composable } = mountWith(() => ICON_URL, { cache: true });
			await vi.waitFor(() => expect(composable.src.value).toBe('blob:hub-media'));
			expect(await blobText(0)).toBe('saved');

			respond({ ok: true, status: 200, blob: async () => new Blob(['fresh'], { type: 'image/png' }) } as Response);
			await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));
			expect(await blobText(1)).toBe('fresh');
			expect(revokeObjectURL).toHaveBeenCalledTimes(1);
		});

		test('drops the copy when the hub says the image is gone', async () => {
			entries.set(ICON_URL, { type: 'image/png', data: new TextEncoder().encode('saved').buffer as ArrayBuffer });
			vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob() } as Response);

			const { composable } = mountWith(() => ICON_URL, { cache: true });

			await vi.waitFor(() => expect(entries.has(ICON_URL)).toBe(false));
			expect(composable.src.value).toBe(ICON_URL);
		});

		test('without the option, neither reads nor writes the cache', async () => {
			entries.set(ICON_URL, { type: 'image/png', data: new TextEncoder().encode('saved').buffer as ArrayBuffer });
			vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

			const { composable } = mountWith(() => ICON_URL);
			await settle();
			await new Promise((resolve) => setTimeout(resolve));

			expect(composable.src.value).toBe(ICON_URL);
			expect(createObjectURL).not.toHaveBeenCalled();
		});
	});
});
