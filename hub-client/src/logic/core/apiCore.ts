// Types
interface ApiUrls {
	[index: string]: string;
}

interface ApiOptions {
	method: string;
	body?: string | Uint8Array;
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

	async api<T>(url: string, options: ApiOptions = this.options.GET): Promise<T> {
		if (this.accessToken) {
			if (!options.headers) {
				options.headers = {};
			}
			options.headers['Authorization'] = 'Bearer ' + this.accessToken;
		}
		console.log(url);
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

		const contentType = response.headers.get('Content-Type') || '';

		try {
			if (contentType.includes('application/json')) {
				const json = await response.json();
				return json as T;
			} else if (contentType.includes('application/octet-stream')) {
				const buffer = await response.arrayBuffer();
				return buffer as unknown as T;
			} else {
				// Fallback: treat as text if it is not either an octet-stream or json response
				const text = await response.text();
				return text as unknown as T;
			}
		} catch {
			return true as T;
		}
	}

	async apiGET<T>(url: string): Promise<T> {
		return this.api<T>(url, this.options.GET);
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

	public async uploadImage(url: string, blob: Blob): Promise<void> {
		// Validate supported image types
		const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
		if (!supportedTypes.includes(blob.type)) {
			throw new Error(`Unsupported file type: ${blob.type}`);
		}

		const response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': blob.type, // Dynamically set based on the Blob's type
				Authorization: `Bearer ${this.accessToken}`,
			},
			body: blob, // Send the raw Blob directly
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to upload file: ${errorText}`);
		}
	}
}

export { Api };
