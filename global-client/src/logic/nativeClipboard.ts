// Packages
import { registerPlugin } from '@capacitor/core';

// Logic
import { blobToBase64 } from '@global-client/logic/utils/blob';

// Types
type ImageClipboardPlugin = {
	copyImage: (options: { data: string }) => Promise<void>;
};

/**
 * Copies an image to the clipboard through our own Android plugin.
 *
 * `navigator.clipboard.write()` is not an option in the native app: inside an Android WebView it
 * resolves as though it worked while leaving the system clipboard untouched, so a copy fails silently.
 * See ImageClipboardPlugin.java.
 */
const ImageClipboard = registerPlugin<ImageClipboardPlugin>('ImageClipboard');

/**
 * @param image the image to put on the clipboard, as PNG
 */
const copyImageNatively = async (image: Blob): Promise<void> => {
	await ImageClipboard.copyImage({ data: await blobToBase64(image) });
};

export { copyImageNatively };
