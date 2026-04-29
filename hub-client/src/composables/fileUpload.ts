// Stores
import { type BlobManager } from '@hub-client/logic/core/blobManager';

import { useDialog } from '@hub-client/stores/dialog';

interface ExtendedFile extends File {
	status: number;
	progress: number;
	blobManager: BlobManager;
}

// Better to pass pubhubs object to useMatrixFiles.
const fileUpload = (errorMsg: string, accessToken: string, uploadUrl: string, fileTypeToCheck: string[], event: Event, callback: (uri: string) => void) => {
	const target = event.currentTarget as HTMLInputElement;
	if (target) {
		const files = target.files;
		if (files) {
			if (fileTypeToCheck.includes(files[0].type)) {
				const fileReader = new FileReader();
				fileReader.readAsArrayBuffer(files[0]);

				const req = new XMLHttpRequest();
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
							callback(uri); // Call the callback function with the URI
						}
					}
				};
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
): Promise<void> => {
	return new Promise((resolve) => {
		const fileReader = new FileReader();
		const req = new XMLHttpRequest();

		fileReader.onprogress = onProgress;

		fileReader.onerror = () => {
			return false;
		};

		fileReader.onload = () => {
			req.open('POST', uploadUrl, true);
			req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
			req.setRequestHeader('Content-Type', file.type);
			req.send(fileReader.result);
		};

		req.onreadystatechange = async function () {
			if (req.readyState !== 4) return;
			if (req.status !== 200) return;

			const { content_uri: uri } = JSON.parse(req.responseText);
			await onReady(uri);

			resolve(); // return the promise
		};

		fileReader.readAsArrayBuffer(file);
	});
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
