// Stores
import { useImageActions } from '@hub-client/composables/useImageActions';
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

import { type BlobManager } from '@hub-client/logic/core/blobManager';
import filters from '@hub-client/logic/core/filters';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

const logger = createLogger('FileUpload');

// Types
interface ExtendedFile extends File {
	status: number;
	progress: number;
	blobManager: BlobManager;
}

/** Why an upload failed, as far as the client can tell. */
type UploadErrorReason = 'unsupported_type' | 'too_large' | 'read_failed' | 'network' | 'rate_limited' | 'forbidden' | 'server' | 'unknown';

/**
 * A failed upload, described well enough to tell the user what went wrong and what to do about it.
 */
type UploadError = {
	reason: UploadErrorReason;
	/** HTTP status of the failed request, or 0 when the request never got that far. */
	status: number;
	key: string;
	params: Record<string, string | number>;
};

/** Rejection of an upload promise.*/
class FileUploadError extends Error {
	info: UploadError;

	constructor(info: UploadError) {
		super(`File upload failed: ${info.reason} (status ${info.status})`);
		this.name = 'FileUploadError';
		this.info = info;
	}
}

// Synapse advertises its limit once per session; `undefined` means we could not find out.
let maxUploadSize: number | undefined = undefined;
let maxUploadSizeLoaded = false;

/**
 * The size limit the media server accepts, used to refuse an oversized file before sending it.
 */
const getMaxUploadSize = async (accessToken: string): Promise<number | undefined> => {
	if (maxUploadSizeLoaded) return maxUploadSize;
	maxUploadSizeLoaded = true;

	const { mediaConfigUrl } = useMatrixFiles();
	try {
		const response = await fetch(mediaConfigUrl, { headers: { Authorization: 'Bearer ' + accessToken } });
		if (response.ok) {
			const size = (await response.json())['m.upload.size'];
			if (typeof size === 'number') maxUploadSize = size;
		} else {
			logger.warn(`Could not read the media config (status ${response.status}), upload size stays unknown.`);
		}
	} catch (error) {
		logger.warn('Could not read the media config, upload size stays unknown:', error);
	}
	return maxUploadSize;
};

/** The errcode of a Matrix error response, if the body is one. */
const matrixErrcode = (responseText: string): string | undefined => {
	try {
		const { errcode } = JSON.parse(responseText);
		return typeof errcode === 'string' ? errcode : undefined;
	} catch {
		// A reverse proxy answers with HTML rather than JSON, which is not an error in itself.
		return undefined;
	}
};

const unsupportedTypeError = (file: File): UploadError =>
	file.type
		? { reason: 'unsupported_type', status: 0, key: 'errors.file_upload_unsupported_type', params: { type: file.type } }
		: { reason: 'unsupported_type', status: 0, key: 'errors.file_upload', params: {} };

/**
 * Turns a rejected upload into a message the user can act on.
 */
const describeUploadError = (status: number, responseText: string, file?: File): UploadError => {
	const errcode = matrixErrcode(responseText);
	const size = file ? filters.formatBytes(file.size, 1) : '';

	if (status === 413 || errcode === 'M_TOO_LARGE') {
		return { reason: 'too_large', status, key: 'errors.file_upload_too_large', params: { size } };
	}
	if (status === 0) {
		// XMLHttpRequest reports a connection that never completed as status 0.
		return { reason: 'network', status, key: 'errors.file_upload_network', params: {} };
	}
	if (status === 429 || errcode === 'M_LIMIT_EXCEEDED') {
		return { reason: 'rate_limited', status, key: 'errors.file_upload_rate_limited', params: {} };
	}
	if (status === 401 || status === 403 || errcode === 'M_UNKNOWN_TOKEN' || errcode === 'M_MISSING_TOKEN' || errcode === 'M_FORBIDDEN') {
		return { reason: 'forbidden', status, key: 'errors.file_upload_forbidden', params: {} };
	}
	if (status === 415) {
		return unsupportedTypeError(file ?? new File([], ''));
	}
	if (status >= 500) {
		return { reason: 'server', status, key: 'errors.file_upload_server', params: { status } };
	}
	return { reason: 'unknown', status, key: 'errors.file_upload_unknown', params: { status } };
};

/** Describes anything a rejected upload may hand back, so no failure path is left without a message. */
const toUploadError = (error: unknown): UploadError => {
	if (error instanceof FileUploadError) return error.info;
	return { reason: 'unknown', status: 0, key: 'errors.file_upload_unknown', params: { status: 0 } };
};

/**
 * Refuses a file the media server is known to be unable to store, so the user hears the actual limit
 * instead of waiting for the upload to be cut off.
 */
const checkUploadSize = async (accessToken: string, file: File): Promise<void> => {
	const max = await getMaxUploadSize(accessToken);
	if (max === undefined || file.size <= max) return;

	throw new FileUploadError({
		reason: 'too_large',
		status: 0,
		key: 'errors.file_upload_too_large_max',
		params: { size: filters.formatBytes(file.size, 1), max: filters.formatBytes(max, 1) },
	});
};

/**
 * Upload avatar with filetypechecking, avatar will be resized if necessary
 * @param file
 * @param onSuccess
 * @param onError
 * @returns
 */
const avatarUpload = async (file: File, onSuccess: (mxUrl: string) => Promise<void>, onError?: (error: UploadError) => void) => {
	const { imageTypes, uploadUrl } = useMatrixFiles();

	if (!imageTypes.includes(file.type)) return onError?.(unsupportedTypeError(file));

	const pubhubs = usePubhubsStore();
	const accessToken = pubhubs.Auth.getAccessToken();
	if (!accessToken) {
		logger.error('Access Token is invalid for File upload.');
		return onError?.({ reason: 'forbidden', status: 0, key: 'errors.file_upload_forbidden', params: {} });
	}

	try {
		await asyncFileUpload(accessToken, uploadUrl, file, () => {}, onSuccess, onError, 1, { maxWidth: 500 });
	} catch {
		// Already reported through onError; swallowed so the caller does not have to catch as well.
	}
};

// Better to pass pubhubs object to useMatrixFiles.
/**
 * Fileupload of single file
 * @param accessToken
 * @param uploadUrl
 * @param fileTypeToCheck
 * @param event
 * @param callback
 * @param onError Receives the reason the upload failed, including a rejected file type
 * @param resize Possible maximum width/height for images
 */
const fileUpload = async (
	accessToken: string,
	uploadUrl: string,
	fileTypeToCheck: string[],
	event: Event,
	callback: (uri: string) => void,
	onError?: (error: UploadError) => void,
	resize?: { maxWidth?: number; maxHeight?: number },
) => {
	const target = event.currentTarget as HTMLInputElement;
	const file = target?.files?.[0];
	if (!file) return;

	if (!fileTypeToCheck.includes(file.type)) return onError?.(unsupportedTypeError(file));

	try {
		await asyncFileUpload(
			accessToken,
			uploadUrl,
			file,
			() => {},
			async (uri) => callback(uri),
			onError,
			0,
			resize,
		);
	} catch {
		// Already reported through onError.
	}
};

/**
 * Sends the file to the media server, retrying only while the server asks us to.
 *
 * Always rejects with a {@link FileUploadError} and calls `onError` exactly once, so neither a
 * caller that awaits nor one that passes a callback can end up without a reason to show.
 *
 * @param accessToken
 * @param uploadUrl
 * @param file
 * @param onProgress
 * @param onReady
 * @param onError
 * @param maxRetries Number of extra attempts after the server answers with a rate limit
 * @param resize
 * @returns
 */
const asyncFileUpload = async (
	accessToken: string,
	uploadUrl: string,
	file: File,
	onProgress: (e: ProgressEvent) => void,
	onReady: (uri: string) => Promise<void>,
	onError?: (error: UploadError) => void,
	maxRetries: number = 3,
	resize?: { maxWidth?: number; maxHeight?: number },
): Promise<void> => {
	try {
		await runUpload(accessToken, uploadUrl, file, onProgress, onReady, maxRetries, resize);
	} catch (error) {
		const info = toUploadError(error);
		logger.error(`Upload of '${file.name}' failed: ${info.reason} (status ${info.status})`, error);
		onError?.(info);
		throw error instanceof FileUploadError ? error : new FileUploadError(info);
	}
};

const runUpload = async (
	accessToken: string,
	uploadUrl: string,
	file: File,
	onProgress: (e: ProgressEvent) => void,
	onReady: (uri: string) => Promise<void>,
	maxRetries: number,
	resize?: { maxWidth?: number; maxHeight?: number },
): Promise<void> => {
	let uploadFile = file;
	if (resize && uploadFile.type.startsWith('image/')) {
		const { resizeImage } = useImageActions();
		uploadFile = (await resizeImage(uploadFile, resize.maxWidth, resize.maxHeight)) as File;
	}

	await checkUploadSize(accessToken, uploadFile);

	const attemptUpload = (): Promise<{ success: boolean; retryAfterMs?: number }> => {
		return new Promise((resolve, reject) => {
			const fileReader = new FileReader();
			const req = new XMLHttpRequest();

			fileReader.onprogress = onProgress;

			fileReader.onerror = () => {
				reject(new FileUploadError({ reason: 'read_failed', status: 0, key: 'errors.file_upload_read_failed', params: {} }));
			};

			fileReader.onload = () => {
				req.open('POST', uploadUrl, true);
				req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
				req.setRequestHeader('Content-Type', uploadFile.type);
				req.send(fileReader.result);
			};

			req.onreadystatechange = function () {
				if (req.readyState !== 4) return;

				if (req.status === 200) {
					try {
						const { content_uri: uri } = JSON.parse(req.responseText);
						onReady(uri)
							.then(() => resolve({ success: true }))
							.catch((err) => {
								logger.error('Error in onReady callback:', err);
								reject(err);
							});
					} catch (err) {
						logger.error('Error parsing upload response:', err);
						reject(err);
					}
				} else if (req.status === 429) {
					// Rate limited - parse retry_after_ms and signal retry
					try {
						const response = JSON.parse(req.responseText);
						const retryAfterMs = response.retry_after_ms ?? 4000;
						logger.warn(`Upload rate limited (429), will retry after ${retryAfterMs}ms`);
						resolve({ success: false, retryAfterMs });
					} catch {
						logger.warn('Upload rate limited (429), will retry after 4000ms');
						resolve({ success: false, retryAfterMs: 4000 });
					}
				} else {
					reject(new FileUploadError(describeUploadError(req.status, req.responseText, uploadFile)));
				}
			};

			fileReader.readAsArrayBuffer(uploadFile);
		});
	};

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const result = await attemptUpload();

		if (result.success) {
			return;
		}

		if (result.retryAfterMs && attempt < maxRetries) {
			// Wait before retry, add small buffer
			await new Promise((resolve) => setTimeout(resolve, result.retryAfterMs! + 500));
			logger.info(`Retrying upload (attempt ${attempt + 2}/${maxRetries + 1})`);
		} else if (attempt >= maxRetries) {
			throw new FileUploadError({ reason: 'rate_limited', status: 429, key: 'errors.file_upload_rate_limited', params: {} });
		}
	}
};

/**
 *
 * @param name Generates a uinique name for file uploads. Duplicate filenames get (2), (3) and so on behind their name
 * @param exists function to determin whether the name already exists
 * @returns
 */
const generateUniqueName = (name: string, exists: (name: string) => boolean): string => {
	const dot = name.lastIndexOf('.');

	const base = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : '';

	// Detect "name (2)" pattern
	const match = base.match(/^(.*)\s\((\d+)\)$/);

	let root = base;
	let counter = 1;

	if (match) {
		root = match[1];
		counter = Number.parseInt(match[2], 10);
	}

	let result = name;

	while (exists(result)) {
		counter++;
		result = `${root} (${counter})${ext}`;
	}

	return result;
};

/** Only for tests: forget the media config so the next upload looks it up again. */
const resetMaxUploadSizeCache = () => {
	maxUploadSize = undefined;
	maxUploadSizeLoaded = false;
};

export {
	avatarUpload,
	fileUpload,
	asyncFileUpload,
	describeUploadError,
	toUploadError,
	generateUniqueName,
	getMaxUploadSize,
	resetMaxUploadSizeCache,
	FileUploadError,
	ExtendedFile,
	type UploadError,
	type UploadErrorReason,
};
