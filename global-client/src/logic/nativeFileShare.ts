// Packages
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Logic
import { blobToBase64 } from '@global-client/logic/utils/blob';

/**
 * Hands a file to the OS on behalf of a hub client.
 *
 * A hub client cannot do this itself: it runs in an iframe, where an `<a download>`
 * is dropped (an Android WebView needs a DownloadListener, and Capacitor registers
 * none) and where Capacitor refuses plugin calls, accepting them from the main
 * frame only. This module runs in that main frame.
 *
 * We write to the cache on purpose: it needs no storage permission on any API
 * level and Android reclaims it by itself. `file_paths.xml` already exposes the
 * cache directory to the FileProvider that Share uses.
 */

/** Refuse implausibly large files rather than trying to base64 them in memory. */
const MAX_FILE_SIZE = 100 * 1024 * 1024;

/** Strips anything that would make a filename traverse or break a path. */
const safeFilename = (filename: string) => {
	const stripped = filename.replace(/[/\\]+/g, '_').replace(/^\.+/, '');
	return stripped.length > 0 ? stripped : 'download';
};

/**
 * @param blob the file's bytes, as received over the messagebox
 * @param filename name to present the file under
 */
const shareFileNatively = async (blob: Blob, filename: string): Promise<void> => {
	if (blob.size > MAX_FILE_SIZE) {
		throw new Error(`Refusing to share a file of ${blob.size} bytes; the limit is ${MAX_FILE_SIZE}.`);
	}

	const data = await blobToBase64(blob);
	const path = safeFilename(filename);

	// No encoding given means the base64 is written back as the original bytes.
	const { uri } = await Filesystem.writeFile({ data, directory: Directory.Cache, path });

	await Share.share({ title: path, url: uri });
};

export { shareFileNatively };
