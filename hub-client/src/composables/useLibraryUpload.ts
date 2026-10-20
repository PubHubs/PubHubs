// Packages
import { computed, ref } from 'vue';

// Composables
import { type UploadError, asyncFileUpload, generateUniqueName, toUploadError } from '@hub-client/composables/fileUpload';
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { SystemDefaults } from '@hub-client/models/constants';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

export enum UploadStatus {
	Waiting = 'waiting',
	Uploading = 'uploading',
	Failed = 'failed',
}

export type LibraryUpload = {
	id: number;
	roomId: string;
	file: File;
	// Unique within the library
	filename: string;
	progress: number;
	status: UploadStatus;
	// Why the upload failed, so the user can tell whether a retry makes sense
	error?: UploadError;
};

const logger = createLogger('LibraryUpload');

let nextId = 0;

// Module level, so uploads survive closing the sidebar. Holds the uploads of all rooms
const queue = ref<LibraryUpload[]>([]);
let running = false;

// For screen reader announcements
const lastFinished = ref<{ roomId: string; filename: string; succeeded: boolean } | null>(null);

/**
 * Uploads files to the room library one at a time, to avoid rate limiting.
 * Finished uploads leave the queue; the file appears once its event arrives through the sync.
 *
 * @param roomId
 * @param currentFileNames Files already in the library, for the limit and unique names
 */
export const useLibraryUpload = (roomId: () => string, currentFileNames: () => string[]) => {
	const pubhubs = usePubhubsStore();
	const { uploadUrl } = useMatrixFiles();

	const uploads = computed(() => queue.value.filter((upload) => upload.roomId === roomId()));

	const finished = computed(() => (lastFinished.value?.roomId === roomId() ? lastFinished.value : null));

	// Includes queued files
	const remaining = computed(() => Math.max(0, SystemDefaults.maxLibraryFiles - currentFileNames().length - uploads.value.length));

	/**
	 * @returns the number of files skipped because the library is full
	 */
	const addFiles = (files: FileList | File[]): number => {
		const list = Array.from(files);
		const accepted = list.slice(0, remaining.value);
		for (const file of accepted) {
			const taken = [...currentFileNames(), ...uploads.value.map((upload) => upload.filename)];
			queue.value.push({
				id: nextId++,
				roomId: roomId(),
				file,
				filename: generateUniqueName(file.name, (name) => taken.includes(name)),
				progress: 0,
				status: UploadStatus.Waiting,
			});
		}
		void run();
		return list.length - accepted.length;
	};

	const retry = (id: number) => {
		const upload = queue.value.find((upload) => upload.id === id);
		if (!upload || upload.status !== UploadStatus.Failed) return;
		upload.status = UploadStatus.Waiting;
		upload.progress = 0;
		void run();
	};

	// Running uploads cannot be cancelled
	const remove = (id: number) => {
		queue.value = queue.value.filter((upload) => upload.id !== id || upload.status === UploadStatus.Uploading);
	};

	const run = async () => {
		if (running) return;
		running = true;
		let upload = queue.value.find((upload) => upload.status === UploadStatus.Waiting);
		while (upload) {
			await uploadOne(upload);
			upload = queue.value.find((upload) => upload.status === UploadStatus.Waiting);
		}
		running = false;
	};

	const uploadOne = async (upload: LibraryUpload) => {
		upload.status = UploadStatus.Uploading;
		try {
			await asyncFileUpload(
				pubhubs.Auth.getAccessToken() as string,
				uploadUrl,
				upload.file,
				(progress: ProgressEvent) => {
					if (progress.total > 0) upload.progress = (progress.loaded / progress.total) * 100;
				},
				async (uri: string) => {
					const success = await pubhubs.addFile(upload.roomId, undefined, upload.filename, upload.file, uri, '', PubHubsMgType.LibraryFileMessage);
					if (!success) throw new Error('The uploaded file could not be added to the library');
				},
			);
			queue.value = queue.value.filter((queued) => queued.id !== upload.id);
			lastFinished.value = { roomId: upload.roomId, filename: upload.filename, succeeded: true };
		} catch (error) {
			logger.error('Library upload failed', error);
			upload.progress = 0;
			upload.status = UploadStatus.Failed;
			upload.error = toUploadError(error);
			lastFinished.value = { roomId: upload.roomId, filename: upload.filename, succeeded: false };
		}
	};

	return { uploads, finished, remaining, addFiles, retry, remove };
};
