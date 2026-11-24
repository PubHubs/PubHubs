// Packages
import { flushPromises } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Composables
import type * as FileUploadModule from '@hub-client/composables/fileUpload';
import type * as LibraryUploadModule from '@hub-client/composables/useLibraryUpload';

// Models
import { SystemDefaults } from '@hub-client/models/constants';

type OnProgress = (e: ProgressEvent) => void;
type OnReady = (uri: string) => Promise<void>;

const addFile = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());

vi.mock('@hub-client/composables/fileUpload', async (importOriginal) => ({
	...(await importOriginal<typeof import('@hub-client/composables/fileUpload')>()),
	asyncFileUpload: upload,
}));

vi.mock('@hub-client/composables/useMatrixFiles', () => ({
	useMatrixFiles: () => ({ uploadUrl: 'upload-url' }),
}));

vi.mock('@hub-client/stores/pubhubs', () => ({
	usePubhubsStore: () => ({ Auth: { getAccessToken: () => 'token' }, addFile }),
}));

// Upload succeeds
const uploadSucceeds = () =>
	upload.mockImplementation(async (_token: string, _url: string, _file: File, _onProgress: OnProgress, onReady: OnReady) => {
		await onReady('mxc://hub/file');
	});

const file = (name: string) => new File(['content'], name);

describe('useLibraryUpload', () => {
	let FileUploadError: typeof FileUploadModule.FileUploadError;
	let describeUploadError: typeof FileUploadModule.describeUploadError;
	let UploadStatus: typeof LibraryUploadModule.UploadStatus;
	let useLibraryUpload: typeof LibraryUploadModule.useLibraryUpload;

	beforeEach(async () => {
		upload.mockReset();
		addFile.mockReset();
		// The queue is module level, so each test gets a fresh module
		vi.resetModules();
		({ UploadStatus, useLibraryUpload } = await import('@hub-client/composables/useLibraryUpload'));
		// From the same fresh module graph, so the library recognises the error class
		({ FileUploadError, describeUploadError } = await import('@hub-client/composables/fileUpload'));
	});

	test('files that do not fit in the library are left out', () => {
		// Never resolves
		upload.mockReturnValue(new Promise(() => {}));
		const existing = Array.from({ length: SystemDefaults.maxLibraryFiles - 2 }, (_, i) => `file ${i}.pdf`);
		const { uploads, remaining, addFiles } = useLibraryUpload(
			() => 'room',
			() => existing,
		);

		expect(addFiles([file('a.pdf'), file('b.pdf'), file('c.pdf')])).toBe(1);
		expect(uploads.value.map((u) => u.filename)).toEqual(['a.pdf', 'b.pdf']);
		expect(remaining.value).toBe(0);
	});

	test('a name that is already in the library gets a number', () => {
		upload.mockReturnValue(new Promise(() => {}));
		const { uploads, addFiles } = useLibraryUpload(
			() => 'room',
			() => ['report.pdf'],
		);

		addFiles([file('report.pdf'), file('report.pdf')]);
		expect(uploads.value.map((u) => u.filename)).toEqual(['report (2).pdf', 'report (3).pdf']);
	});

	test('keeps uploads when the library is reopened', () => {
		upload.mockReturnValue(new Promise(() => {}));
		useLibraryUpload(
			() => 'room',
			() => [],
		).addFiles([file('a.pdf')]);

		const reopened = useLibraryUpload(
			() => 'room',
			() => [],
		);
		expect(reopened.uploads.value.map((u) => u.filename)).toEqual(['a.pdf']);
		expect(reopened.uploads.value[0].status).toBe(UploadStatus.Uploading);
	});

	test('progress follows the upload as it is sent', async () => {
		let reportProgress: OnProgress = () => {};
		upload.mockImplementation((_token: string, _url: string, _file: File, onProgress: OnProgress) => {
			reportProgress = onProgress;
			return new Promise(() => {});
		});
		const { uploads, addFiles } = useLibraryUpload(
			() => 'room',
			() => [],
		);

		addFiles([file('a.pdf')]);
		reportProgress({ loaded: 30, total: 120 } as ProgressEvent);
		expect(uploads.value[0].progress).toBe(25);
	});

	test('adds a finished upload to the room it was started in', async () => {
		uploadSucceeds();
		addFile.mockResolvedValue(true);
		let roomId = 'first room';
		const { uploads, finished, addFiles } = useLibraryUpload(
			() => roomId,
			() => [],
		);

		addFiles([file('a.pdf')]);
		roomId = 'second room';
		await flushPromises();

		expect(addFile).toHaveBeenCalledWith('first room', undefined, 'a.pdf', expect.any(File), 'mxc://hub/file', '', expect.anything());
		expect(uploads.value).toEqual([]);
		// Not announced in another room
		expect(finished.value).toBeNull();
	});

	test('a failed upload stays in the queue until it is retried', async () => {
		upload.mockRejectedValueOnce(new Error('network'));
		const { uploads, finished, addFiles, retry } = useLibraryUpload(
			() => 'room',
			() => [],
		);

		addFiles([file('a.pdf')]);
		await flushPromises();
		expect(uploads.value[0].status).toBe(UploadStatus.Failed);
		expect(finished.value).toEqual({ roomId: 'room', filename: 'a.pdf', succeeded: false });

		uploadSucceeds();
		addFile.mockResolvedValue(true);
		retry(uploads.value[0].id);
		await flushPromises();
		expect(uploads.value).toEqual([]);
		expect(finished.value).toEqual({ roomId: 'room', filename: 'a.pdf', succeeded: true });
	});

	test('a failed upload keeps the reason it failed', async () => {
		upload.mockRejectedValueOnce(new FileUploadError(describeUploadError(413, '', new File(['content'], 'big.pdf'))));
		upload.mockRejectedValueOnce(new Error('network'));
		const { uploads, addFiles } = useLibraryUpload(
			() => 'room',
			() => [],
		);

		addFiles([file('big.pdf'), file('a.pdf')]);
		await flushPromises();
		expect(uploads.value.map((u) => u.error?.reason)).toEqual(['too_large', 'unknown']);
	});

	test('an upload the library does not accept counts as failed', async () => {
		uploadSucceeds();
		addFile.mockResolvedValue(false);
		const { uploads, addFiles, remove } = useLibraryUpload(
			() => 'room',
			() => [],
		);

		addFiles([file('a.pdf')]);
		await flushPromises();
		expect(uploads.value[0].status).toBe(UploadStatus.Failed);

		remove(uploads.value[0].id);
		expect(uploads.value).toEqual([]);
	});
});
