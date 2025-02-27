import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, test, beforeEach } from 'vitest';

import { useMatrixFiles, downloadUrl } from '@/logic/composables/useMatrixFiles';

describe('useMatrixFiles', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
	});

	test('formUrlfromMxc', () => {
		const matrixFiles = useMatrixFiles();

		expect(matrixFiles.downloadUrl.indexOf('/_matrix/media/r0/download')).toBeGreaterThan(1);
		expect(matrixFiles.uploadUrl.indexOf('/_matrix/media/r0/upload')).toBeGreaterThan(1);

		const mxc = 'mxc://main.testhub-matrix.ihub.ru.nl/GlrNbVBwYhSEKUcePOSHdyQV';
		const url = matrixFiles.formUrlfromMxc(mxc);
		expect(url.indexOf(matrixFiles.downloadUrl)).toBe(0);
		expect(url.indexOf(mxc.slice(6))).toBeGreaterThan(1);

		const badmxc = '../../../mailware';
		const badurl = matrixFiles.formUrlfromMxc(badmxc);
		expect(badurl.indexOf(matrixFiles.downloadUrl)).toBe(-1);
		expect(badurl.indexOf(mxc.slice(6))).toBe(-1);
	});
});
