export function useImageActions() {
	async function copyImage(url: string) {
		const response = await fetch(url);
		const blob = await response.blob();
		const pngBlob = await convertToPng(blob);
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
	}

	/**
	 * Resize an image back to a maximum width or height without changing aspect ratio
	 * @param image image to resize
	 * @param maxWidth maximum width in pixels
	 * @param maxHeight maximum height in pixels
	 * @returns scaled image
	 */
	function resizeImage(image: File, maxWidth?: number, maxHeight?: number): Promise<File>;
	function resizeImage(image: Blob, maxWidth?: number, maxHeight?: number): Promise<Blob>;
	function resizeImage(image: Blob | File, maxWidth?: number, maxHeight?: number): Promise<Blob | File> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const url = URL.createObjectURL(image);
			img.onload = () => {
				URL.revokeObjectURL(url);
				let { naturalWidth: width, naturalHeight: height } = img;

				// Is scaling needed?
				let scale = 1;
				if (maxWidth && width > maxWidth) scale = Math.min(scale, maxWidth / width);
				if (maxHeight && height > maxHeight) scale = Math.min(scale, maxHeight / height);

				if (scale === 1) {
					resolve(image);
					return;
				}

				width = Math.round(width * scale);
				height = Math.round(height * scale);

				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Failed to get 2d canvas context'));
					return;
				}
				ctx.drawImage(img, 0, 0, width, height);

				const type = image.type || 'image/jpeg';
				canvas.toBlob((resizedBlob) => {
					if (!resizedBlob) {
						reject(new Error('Failed to resize image'));
						return;
					}
					if (image instanceof File) {
						resolve(new File([resizedBlob], image.name, { type, lastModified: image.lastModified }));
					} else {
						resolve(resizedBlob);
					}
				}, type);
			};
			img.onerror = () => {
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load image for resizing'));
			};
			img.src = url;
		});
	}

	return { copyImage, resizeImage };
}

function convertToPng(blob: Blob): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d');
			if (!ctx) {
				reject(new Error('Failed to get 2d canvas context'));
				return;
			}
			ctx.drawImage(img, 0, 0);
			canvas.toBlob((pngBlob) => {
				if (pngBlob) resolve(pngBlob);
				else reject(new Error('Failed to convert to PNG'));
			}, 'image/png');
		};
		img.onerror = reject;
		img.src = URL.createObjectURL(blob);
	});
}
