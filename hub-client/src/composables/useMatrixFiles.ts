import { usePubHubs } from '@/core/pubhubsStore';

const useMatrixFiles = () => {
	const pubhubs = usePubHubs();
	const downloadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/download/';
	const uploadUrl = pubhubs.getBaseUrl + '/_matrix/media/r0/upload';
	const deleteUrl = pubhubs.getBaseUrl + '/_synapse/admin/v1/media/';

	const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg'];
	const mediaTypes = ['audio/wave', 'audio/wav', 'audio/x-wav', 'audio/x-pn-wav', 'audio/webm', 'video/webm', 'audio/ogg', 'video/ogg', 'application/ogg'];
	const fileTypes = [
		'application/pdf',
		'application/txt',
		'text/plain',
		'application/vnd.oasis.opendocument.presentation',
		'application/vnd.oasis.opendocument.text',
		'application/vnd.ms-powerpoint',
		'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'application/rtf',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'application/zip',
		'text/calendar',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'text/csv',
	];

	const allTypes = [...imageTypes, ...mediaTypes, ...fileTypes];

	function getTypesAsString(types: Array<string>) {
		return types.join(',');
	}

	function formUrlfromMxc(mxc: string) {
		if (mxc.indexOf('mxc:/') !== 0) {
			return '';
		}
		const url = new URL(downloadUrl + mxc.slice(6)).toString();
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

	return { downloadUrl, uploadUrl, formUrlfromMxc, deleteMediaUrlfromMxc, imageTypes, mediaTypes, fileTypes, allTypes, getTypesAsString, isImage, isAllowed };
};

export { useMatrixFiles };
