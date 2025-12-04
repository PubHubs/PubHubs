// Stores
import { useDialog } from '@hub-client/stores/dialog';

interface ExtendedFile extends File {
	status: number;
	progress: number;
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

const asyncFileUpload = (accessToken: string, uploadUrl: string, file: File, onProgress: Function, onReady: Function) => {
	const fileReader = new FileReader();
	fileReader.readAsArrayBuffer(file);

	fileReader.onprogress = (e) => {
		onProgress(e);
	};

	fileReader.onerror = () => {
		return false;
	};

	const req = new XMLHttpRequest();
	fileReader.onload = () => {
		req.open('POST', uploadUrl, true);
		req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
		req.setRequestHeader('Content-Type', file.type);
		req.send(fileReader.result);
	};

	req.onreadystatechange = function () {
		if (req.readyState === 4) {
			if (req.status === 200) {
				const obj = JSON.parse(req.responseText);
				const uri = obj.content_uri;
				onReady(uri);
			}
		}
	};
};

export { fileUpload, asyncFileUpload, ExtendedFile };
