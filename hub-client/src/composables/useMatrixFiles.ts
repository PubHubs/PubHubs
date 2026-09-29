// Models
import { allTypes, fileTypes, imageTypes, imageTypesExt, mediaTypes } from '@hub-client/models/constants';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

function isImage(img: string) {
	const ext = img.split('.').pop()?.toLocaleLowerCase();
	return ext ? imageTypesExt.includes(ext) : false;
}

const useMatrixFiles = () => {
	const pubhubs = usePubhubsStore();
	const downloadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/download/';
	const uploadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/upload';
	const deleteUrl = pubhubs.getBaseUrl + '/_synapse/admin/v1/media/';
	// Advertises `m.upload.size`, the largest file the media server will store.
	const mediaConfigUrl = pubhubs.getBaseUrl + '/_matrix/media/v3/config';

	function formUrlfromMxc(mxc: string, useAuthenticatedMediaEndpoint = false) {
		if (!mxc.startsWith('mxc:/')) {
			return '';
		}

		let downloadEndpoint = downloadUrl;
		if (useAuthenticatedMediaEndpoint) {
			downloadEndpoint = `${pubhubs.getBaseUrl}/_matrix/client/v1/media/download/`;
		}

		const url = new URL(downloadEndpoint + mxc.slice(6)).toString();
		return url;
	}

	function deleteMediaUrlfromMxc(mxc: string) {
		if (!mxc.startsWith('mxc:/')) {
			return '';
		}
		const url = new URL(deleteUrl + mxc.slice(6)).toString();
		return url;
	}

	function isAllowed(type: string) {
		return allTypes.includes(type);
	}

	async function getAuthorizedMediaUrl(url: string): Promise<string> {
		const settings = useSettings();
		if (!settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) {
			return url;
		}

		const matrixURL = formUrlfromMxc(url, true);

		return await pubhubs.fetchAuthorizedMediaUrl(matrixURL);
	}

	return {
		downloadUrl,
		uploadUrl,
		mediaConfigUrl,
		formUrlfromMxc,
		deleteMediaUrlfromMxc,
		imageTypes,
		mediaTypes,
		fileTypes,
		allTypes,
		isImage,
		isAllowed,
		getAuthorizedMediaUrl,
	};
};

export type MatrixFilesStore = ReturnType<typeof useMatrixFiles>;

export { useMatrixFiles };
