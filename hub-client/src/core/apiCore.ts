/**
 *
 * This class has generic API functions for hub and global
 *
 */

interface ApiUrls {
	[index: string]: string;
}

interface ApiOptions {
	method: string;
	body?: string;
	headers?: any;
}

interface AllApiOptions {
	[index: string]: ApiOptions;
}

class Api {
	baseURL: string;
	apiURLS: ApiUrls;
	etag: string;
	accessToken: string;
	options: AllApiOptions;

	constructor(baseURL: string, urls: ApiUrls) {
		this.baseURL = baseURL;
		this.apiURLS = urls;
		for (const key in this.apiURLS) {
			this.apiURLS[key] = this.baseURL.concat('/', this.apiURLS[key]).replace(/\b\/+?\b/g, '/');
		}
		this.options = {
			GET: {
				method: 'GET',
			},
			POST: {
				method: 'POST',
			},
			PUT: {
				method: 'PUT',
			},
			DELETE: {
				method: 'DELETE',
			},
		};
		this.etag = '';
		this.accessToken = '';
	}

	setAccessToken(token: string) {
		this.accessToken = token;
	}

	fetchEtagFromHeaders(headers: Headers): string {
		if (headers.get('etag')) {
			this.etag = headers.get('etag') as string;
		}
		return this.etag;
	}

	async api<T>(url: string, options: ApiOptions = this.options.GET, defaultResponseData: any = undefined): Promise<T> {
		if (this.accessToken) {
			if (!options.headers) {
				options.headers = {};
			}
			options.headers['Authorization'] = 'Bearer ' + this.accessToken;
		}
		const response = await fetch(url, options as RequestInit);
		if (!response.ok) {
			try {
				const result = await response.text();
				const json = JSON.parse(result);
				if (typeof json.error !== 'undefined') {
					throw new Error(json.error);
				} else if (typeof json.errors !== 'undefined') {
					throw new Error(json.errors);
				}
				throw new Error(result);
			} catch (error: any) {
				throw new Error(error);
			}
		}
		this.fetchEtagFromHeaders(response.headers);
		if (response.status === 204) {
			return true as T;
		}
		// Test if JSON response
		try {
			const text = await response.text();
			const json = JSON.parse(text);
			return json as T;
		} catch {
			return defaultResponseData as T;
		}
	}

	async apiGET<T>(url: string, defaultResponseData: any = undefined): Promise<T> {
		return this.api<T>(url, this.options.GET, defaultResponseData);
	}

	async apiPOST<T>(url: string, data: any): Promise<T> {
		const options = this.options.POST;
		options.body = JSON.stringify(data);
		return this.api<T>(url, options);
	}

	async apiPUT<T>(url: string, data: any, etag: boolean = false): Promise<T> {
		const options = this.options.PUT;
		options.headers = {
			'Content-Type': 'application/octet-stream',
		};
		if (etag) {
			options.headers = {
				'Content-Type': 'application/octet-stream',
				'If-Match': this.etag,
			};
		}
		options.body = JSON.stringify(data);
		return this.api<T>(url, options);
	}

	async apiDELETE<T>(url: string, data?: any): Promise<T> {
		const options = this.options.DELETE;
		if (typeof data !== 'undefined') {
			options.body = JSON.stringify(data);
			options.headers = {
				'Content-Type': 'application/json',
			};
		}
		const response = await this.api<T>(url, options);
		return response;
	}

	public async uploadFile(url: string, blob: Blob): Promise<void> {
		const requestBody = new FormData();
		requestBody.append('blob', blob);
		requestBody.append('blobType', blob.type);

		const response = await fetch(url, {
			method: 'POST',
			body: requestBody,
			headers: {
				Authorization: `Bearer ${this.accessToken}`,
			},
		});

		if (!response.ok) {
			throw new Error('Failed to upload file');
		}
	}
}

export { Api };
