// Stores
import { Message, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
import { useSettings } from '@hub-client/stores/settings';

// Types
type FileShareRequest = {
	blob: Blob;
	filename: string;
};

/**
 * Whether the global client has to act on this client's behalf.
 *
 * In the native app this client runs in an iframe, and a download started from an
 * iframe goes nowhere: an Android WebView only saves a download when the host app
 * registers a DownloadListener, and Capacitor registers none. Capacitor's own
 * plugins are no way out either, since it accepts plugin calls from the main frame
 * only. So the global client, which is that frame, has to do it for us.
 *
 * The clipboard is out of reach from here for the same reason -- see
 * MessageType.ClipboardWrite, which predates this and works around it for text.
 */
const shouldDelegateToGlobalClient = () => useSettings().isNativeApp;

/**
 * Asks the global client to hand a file to the OS.
 *
 * Fire and forget: the messagebox has no reply channel for this, and the global
 * client reports its own failures.
 *
 * @param blobUrl blob: URL holding the already-fetched file
 * @param filename name to present the file under
 */
const requestFileShare = async (blobUrl: string, filename: string): Promise<void> => {
	// postMessage structured-clones the blob, so the bytes need no encoding here.
	const blob = await (await fetch(blobUrl)).blob();
	const content: FileShareRequest = { blob, filename };

	useMessageBox().sendMessage(new Message(MessageType.FileShare, content));
};

export { requestFileShare, shouldDelegateToGlobalClient };
export type { FileShareRequest };
