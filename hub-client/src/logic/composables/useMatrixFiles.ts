import { allTypes, fileTypes, imageTypes, mediaTypes } from '@/model/constants';

import { usePubHubs } from '@/logic/core/pubhubsStore';

const useMatrixFiles = () => {
	const pubhubs = usePubHubs();
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

	function isImage(type: string) {
		return imageTypes.indexOf(type) >= 0;
	}

	function isAllowed(type: string) {
		return allTypes.indexOf(type) >= 0;
	}

	async function useAuthorizedMediaUrl(url: string, useAuthenticatedMediaURL = false): Promise<string> {
		const matrixURL = formUrlfromMxc(url, useAuthenticatedMediaURL);

		// For legacy unauthenticated media url
		if (!useAuthenticatedMediaURL) return matrixURL;
		// For Authenticated media
		const fetchedAuthorizedUrl = await pubhubs.getAuthorizedMediaUrl(matrixURL);
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
		useAuthorizedMediaUrl,
	};
};

export type MatrixFilesStore = ReturnType<typeof useMatrixFiles>;

export { useMatrixFiles };
