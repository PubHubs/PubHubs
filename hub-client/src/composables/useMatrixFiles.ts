// Models
import { allTypes, fileTypes, imageTypes, imageTypesExt, mediaTypes } from '@hub-client/models/constants';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

const useMatrixFiles = () => {
	const pubhubs = usePubhubsStore();
	const downloadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/download/';
	const uploadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/upload';
	const deleteUrl = pubhubs.getBaseUrl + '/_synapse/admin/v1/media/';

	function getTypesAsString(types: Array<string>) {
		return types.join(',');
	}

	function isMxcUrl(mxc: string): boolean {
		if (!mxc) {
			return false;
		}
		return mxc.indexOf('mxc:/') === 0;
	}

	function formUrlfromMxc(mxc: string, useAuthenticatedMediaEndpoint = false) {
		if (mxc.indexOf('mxc:/') !== 0) {
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
		if (mxc.indexOf('mxc:/') !== 0) {
			return '';
		}
		const url = new URL(deleteUrl + mxc.slice(6)).toString();
		return url;
	}

	function isImage(img: string) {
		if (typeof img !== 'string') return false;
		const ext = img.split('.').pop()?.toLocaleLowerCase();
		return ext ? imageTypesExt.indexOf(ext) >= 0 : false;
	}

	function isAllowed(type: string) {
		return allTypes.indexOf(type) >= 0;
	}

	async function getAuthorizedMediaUrl(url: string): Promise<string> {
		const settings = useSettings();
		if (!settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) {
			return url;
		}

		const matrixURL = formUrlfromMxc(url, true);

		const fetchedAuthorizedUrl = await pubhubs.fetchAuthorizedMediaUrl(matrixURL);
		if (fetchedAuthorizedUrl === null) throw new Error('Could not get authorized media URL');
		return fetchedAuthorizedUrl;
	}

	return {
		downloadUrl,
		uploadUrl,
		isMxcUrl,
		formUrlfromMxc,
		deleteMediaUrlfromMxc,
		imageTypes,
		mediaTypes,
		fileTypes,
		allTypes,
		getTypesAsString,
		isImage,
		isAllowed,
		getAuthorizedMediaUrl,
	};
};

export type MatrixFilesStore = ReturnType<typeof useMatrixFiles>;

export { useMatrixFiles };
