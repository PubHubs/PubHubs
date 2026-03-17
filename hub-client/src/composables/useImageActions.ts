export function useImageActions() {
	async function copyImage(url: string) {
		const response = await fetch(url);
		const blob = await response.blob();
		const pngBlob = await convertToPng(blob);
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
	}

	function saveImage(url: string, filename: string) {
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
	}

	return { copyImage, saveImage };
}

function convertToPng(blob: Blob): Promise<Blob> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = img.naturalWidth;
			canvas.height = img.naturalHeight;
			const ctx = canvas.getContext('2d')!;
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
