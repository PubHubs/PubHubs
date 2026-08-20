// Packages
import { ref } from 'vue';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

const logger = createLogger('useFileDownload');

// A blob URL must outlive the click that started the download, but not the session.
const REVOKE_DELAY_MS = 60_000;
// Keeps the second click (and other rapid repeats) from saving the same file twice.
const REPEAT_DELAY_MS = 1_000;

// Shared between components, so a file being fetched is recognised wherever it is shown.
const busy = ref<Set<string>>(new Set());

/**
 * Saves Matrix media to the user's device.
 *
 * The media is fetched when the user asks for it instead of when a list of files renders,
 * so opening a file list no longer pulls every file over the network.
 */
const useFileDownload = () => {
	const { getAuthorizedMediaUrl, formUrlfromMxc } = useMatrixFiles();

	const isDownloading = (mxcUrl: string) => busy.value.has(mxcUrl);

	/**
	 * @param mxcUrl the `mxc://` url of the media
	 * @param filename name the file gets on disk
	 * @returns false only when the download failed; a repeated request while one is running is not a failure
	 */
	async function downloadFile(mxcUrl: string, filename: string): Promise<boolean> {
		if (!mxcUrl) return false;
		if (busy.value.has(mxcUrl)) return true;
		busy.value.add(mxcUrl);
		try {
			const url = await getAuthorizedMediaUrl(mxcUrl);
			// Without authenticated media the mxc url comes back unchanged, and the browser cannot fetch that.
			const href = url.startsWith('mxc:/') ? formUrlfromMxc(url) : url;
			if (!href) throw new Error(`Could not resolve a download url for ${mxcUrl}`);
			saveAs(href, filename);
			// The blob was created here, so it is also cleaned up here. Callers that pass a url they own
			// keep their own blob alive.
			if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), REVOKE_DELAY_MS);
			setTimeout(() => busy.value.delete(mxcUrl), REPEAT_DELAY_MS);
			return true;
		} catch (error) {
			logger.error('Failed to download file', { url: mxcUrl, error });
			busy.value.delete(mxcUrl);
			return false;
		}
	}

	return { downloadFile, isDownloading };
};

/**
 * Triggers the browser's save dialog for a url the caller already has. Revoking a blob url afterwards is
 * up to whoever created it.
 *
 * @param href blob url, or a url on the media server
 * @param filename name the file gets on disk
 */
function saveAs(href: string, filename: string) {
	const anchor = document.createElement('a');
	anchor.href = href;
	anchor.download = filename;
	// A cross origin url ignores the download attribute and would navigate the hub client away instead,
	// so such a url is opened in a tab of its own.
	if (!href.startsWith('blob:')) {
		anchor.target = '_blank';
		anchor.rel = 'noopener';
	}
	// The anchor has to be in the document for Firefox to honour the click.
	anchor.style.display = 'none';
	document.body.appendChild(anchor);
	anchor.click();
	anchor.remove();
}

export { saveAs, useFileDownload };
