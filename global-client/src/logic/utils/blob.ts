/**
 * Reads a blob as base64, without the data-URL prefix.
 *
 * The native plugins take bytes as base64, since only strings and numbers survive
 * the bridge between the web layer and Java.
 */
const blobToBase64 = (blob: Blob): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(reader.error);
		// readAsDataURL yields "data:<type>;base64,<data>"; only the data is wanted.
		reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
		reader.readAsDataURL(blob);
	});

export { blobToBase64 };
