// Logic
import { requestFileShare, shouldDelegateToGlobalClient } from '@hub-client/logic/core/requestFileShare';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';

const logger = createLogger('useImageActions');

export function useImageActions() {
	// Both actions are invoked from a context menu that does not await them, so they
	// report their own failures rather than rejecting into nothing.

	async function copyImage(url: string) {
		try {
			const response = await fetch(url);
			const pngBlob = await convertToPng(await response.blob());

			if (shouldDelegateToGlobalClient()) {
				useMessageBox().sendMessage(new Message(MessageType.ClipboardWriteImage, pngBlob));
				return;
			}

			await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
		} catch (error) {
			logger.error('Failed to copy the image.', { error });
		}
	}

	async function saveImage(url: string, filename: string) {
		try {
			if (shouldDelegateToGlobalClient()) {
				await requestFileShare(url, filename);
				return;
			}

			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			a.click();
		} catch (error) {
			logger.error('Failed to save the image.', { error });
		}
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
