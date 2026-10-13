// Packages
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Composables
import { FileUploadError, asyncFileUpload, describeUploadError, resetMaxUploadSizeCache, toUploadError } from '@hub-client/composables/fileUpload';

// The 413 a reverse proxy in front of the hub returns: HTML, with no mention of the actual limit.
const nginxTooLarge =
	'<html>\n<head><title>413 Request Entity Too Large</title></head>\n<body>\n<center><h1>413 Request Entity Too Large</h1></center>\n</body>\n</html>';

const fileOf = (bytes: number) => new File([new Uint8Array(bytes)], 'holiday.png', { type: 'image/png' });

describe('describeUploadError', () => {
	test('names the size when the proxy rejects the file with an HTML 413', () => {
		const error = describeUploadError(413, nginxTooLarge, fileOf(2048));

		expect(error.reason).toBe('too_large');
		expect(error.key).toBe('errors.file_upload_too_large');
		expect(error.params.size).toBe('2 KB');
	});

	test('recognises the hub refusing the file itself', () => {
		const error = describeUploadError(502, '{"errcode":"M_TOO_LARGE","error":"Upload request body is too large"}');

		expect(error.reason).toBe('too_large');
	});

	test('reports a request that never reached the hub as a connection problem', () => {
		expect(describeUploadError(0, '').reason).toBe('network');
	});

	test('separates rate limiting, rejected credentials and server faults', () => {
		expect(describeUploadError(429, '{"errcode":"M_LIMIT_EXCEEDED"}').reason).toBe('rate_limited');
		expect(describeUploadError(403, '{"errcode":"M_FORBIDDEN"}').reason).toBe('forbidden');
		expect(describeUploadError(502, '<html>bad gateway</html>').reason).toBe('server');
	});

	test('falls back to a message naming the status, so no failure is silent', () => {
		const error = describeUploadError(418, 'no idea');

		expect(error.reason).toBe('unknown');
		expect(error.params.status).toBe(418);
	});
});

describe('toUploadError', () => {
	test('keeps the classification of an upload rejection', () => {
		const info = describeUploadError(413, nginxTooLarge, fileOf(1024));

		expect(toUploadError(new FileUploadError(info))).toEqual(info);
	});

	test('still describes an error that came from somewhere else', () => {
		expect(toUploadError(new Error('boom')).key).toBe('errors.file_upload_unknown');
	});
});

describe('asyncFileUpload', () => {
	/** Answers every request with the same status, so an upload settles instead of hanging. */
	const stubXhr = (status: number, responseText: string) => {
		const sent = vi.fn();
		class FakeXhr {
			readyState = 0;
			status = 0;
			responseText = '';
			onreadystatechange: (() => void) | null = null;

			open() {}
			setRequestHeader() {}
			send(body: unknown) {
				sent(body);
				this.readyState = 4;
				this.status = status;
				this.responseText = responseText;
				this.onreadystatechange?.();
			}
		}
		vi.stubGlobal('XMLHttpRequest', FakeXhr);
		return sent;
	};

	const stubMediaConfig = (config: Promise<unknown>) => vi.stubGlobal('fetch', vi.fn().mockReturnValue(config));

	beforeEach(() => {
		setActivePinia(createPinia());
		resetMaxUploadSizeCache();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	test('refuses a file over the advertised limit without sending it, and names the limit', async () => {
		stubMediaConfig(Promise.resolve({ ok: true, status: 200, json: async () => ({ 'm.upload.size': 1024 }) }));
		const sent = stubXhr(200, '{"content_uri":"mxc://hub.example/abc"}');
		const onError = vi.fn();

		await expect(
			asyncFileUpload(
				'token',
				'https://hub.example/upload',
				fileOf(4096),
				() => {},
				async () => {},
				onError,
			),
		).rejects.toThrow(FileUploadError);

		expect(sent).not.toHaveBeenCalled();
		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0][0]).toMatchObject({
			reason: 'too_large',
			key: 'errors.file_upload_too_large_max',
			params: { size: '4 KB', max: '1 KB' },
		});
	});

	test('sends the file anyway when the limit cannot be read', async () => {
		stubMediaConfig(Promise.reject(new Error('offline')));
		const sent = stubXhr(200, '{"content_uri":"mxc://hub.example/abc"}');
		const onReady = vi.fn().mockResolvedValue(undefined);

		await asyncFileUpload('token', 'https://hub.example/upload', fileOf(4096), () => {}, onReady);

		expect(sent).toHaveBeenCalled();
		expect(onReady).toHaveBeenCalledWith('mxc://hub.example/abc');
	});

	test('reports the proxy 413 to the caller and to anyone awaiting the upload', async () => {
		stubMediaConfig(Promise.resolve({ ok: false, status: 404, json: async () => ({}) }));
		stubXhr(413, nginxTooLarge);
		const onError = vi.fn();

		await expect(
			asyncFileUpload(
				'token',
				'https://hub.example/upload',
				fileOf(4096),
				() => {},
				async () => {},
				onError,
			),
		).rejects.toMatchObject({
			info: { reason: 'too_large' },
		});

		expect(onError).toHaveBeenCalledTimes(1);
		expect(onError.mock.calls[0][0].key).toBe('errors.file_upload_too_large');
	});

	test('gives up on a rate limited upload with a reason rather than a bare error', async () => {
		stubMediaConfig(Promise.resolve({ ok: false, status: 404, json: async () => ({}) }));
		stubXhr(429, '{"errcode":"M_LIMIT_EXCEEDED","retry_after_ms":1}');
		const onError = vi.fn();

		await expect(
			asyncFileUpload(
				'token',
				'https://hub.example/upload',
				fileOf(16),
				() => {},
				async () => {},
				onError,
				0,
			),
		).rejects.toThrow(FileUploadError);

		expect(onError.mock.calls[0][0].reason).toBe('rate_limited');
	});
});
