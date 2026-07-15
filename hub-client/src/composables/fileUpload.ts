// Stores
import { type BlobManager } from '@hub-client/logic/core/blobManager';
import { createLogger } from '@hub-client/logic/logging/Logger';

import { useDialog } from '@hub-client/stores/dialog';

const logger = createLogger('FileUpload');

interface ExtendedFile extends File {
	status: number;
	progress: number;
	blobManager: BlobManager;
}

// Better to pass pubhubs object to useMatrixFiles.
const fileUpload = (
	errorMsg: string,
	accessToken: string,
	uploadUrl: string,
	fileTypeToCheck: string[],
	event: Event,
	callback: (uri: string) => void,
	onError?: (status: number, response: string) => void,
) => {
	const target = event.currentTarget as HTMLInputElement;
	if (target) {
		const files = target.files;
		if (files) {
			if (fileTypeToCheck.includes(files[0].type)) {
				const fileReader = new FileReader();
				const req = new XMLHttpRequest();

				fileReader.onerror = () => {
					logger.error('Failed to read file');
					if (onError) {
						onError(0, 'Failed to read file');
					} else {
						const dialog = useDialog();
						dialog.confirm(errorMsg);
					}
				};

				fileReader.onload = () => {
					req.open('POST', uploadUrl, true);
					req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
					req.setRequestHeader('Content-Type', files[0].type);
					req.send(fileReader.result);
				};

				req.onreadystatechange = function () {
					if (req.readyState === 4) {
						if (req.status === 200) {
							const obj = JSON.parse(req.responseText);
							const uri = obj.content_uri;
							callback(uri);
						} else {
							logger.error(`Upload failed with status ${req.status}:`, req.responseText);
							if (onError) {
								onError(req.status, req.responseText);
							} else {
								const dialog = useDialog();
								dialog.confirm(errorMsg);
							}
						}
					}
				};

				fileReader.readAsArrayBuffer(files[0]);
			} else {
				const dialog = useDialog();

				// TODO: texts needs to be checked by Bart
				dialog.confirm(errorMsg);
			}
		}
	}
};

const asyncFileUpload = async (
	accessToken: string,
	uploadUrl: string,
	file: File,
	onProgress: (e: ProgressEvent) => void,
	onReady: (uri: string) => Promise<void>,
	onError?: (status: number, response: string) => void,
	maxRetries: number = 3,
): Promise<void> => {
	const attemptUpload = (): Promise<{ success: boolean; retryAfterMs?: number }> => {
		return new Promise((resolve, reject) => {
			const fileReader = new FileReader();
			const req = new XMLHttpRequest();

			fileReader.onprogress = onProgress;

			fileReader.onerror = () => {
				reject(new Error('Failed to read file'));
			};

			fileReader.onload = () => {
				req.open('POST', uploadUrl, true);
				req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
				req.setRequestHeader('Content-Type', file.type);
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
					// Handle other errors - log and call error callback if provided
					logger.error(`Upload failed with status ${req.status}:`, req.responseText);
					if (onError) {
						onError(req.status, req.responseText);
					}
					reject(new Error(`Upload failed with status ${req.status}`));
				}
			};

			fileReader.readAsArrayBuffer(file);
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
			throw new Error('Upload failed: rate limit exceeded after maximum retries');
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
		counter = parseInt(match[2], 10);
	}

	let result = name;

	while (exists(result)) {
		counter++;
		result = `${root} (${counter})${ext}`;
	}

	return result;
};

export { fileUpload, asyncFileUpload, generateUniqueName, ExtendedFile };
