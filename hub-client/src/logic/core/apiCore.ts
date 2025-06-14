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
		try {
			const response = await fetch(url, options as RequestInit);
			if (!response.ok) {
				try {
					const result = await response.text();
					const json = JSON.parse(result);
					if (json.error || json.errors) {
						console.error(json.error ?? json.errors);
					} else {
						console.error(result);
					}
					return defaultResponseData as T;
				} catch (error: any) {
					console.error('Failed to parse error response:', error);
					return defaultResponseData as T;
				}
			}
			this.fetchEtagFromHeaders(response.headers);
			if (response.status === 204) {
				if (typeof defaultResponseData === 'boolean') {
					return true as T;
				}
				// Optionally throw or return fallback
				return defaultResponseData as T;
			}
			// Test if JSON response
			try {
				const text = await response.text();
				const json = JSON.parse(text);
				return json as T;
			} catch {
				return defaultResponseData as T;
			}
		} catch (error: any) {
			console.error(error);
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

	public async uploadImage(url: string, blob: Blob): Promise<void> {
		// Validate supported image types
		const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml'];
		if (!supportedTypes.includes(blob.type)) {
			console.error(`Unsupported file type: ${blob.type}`);
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
			console.error(`Failed to upload file: ${errorText}`);
		}
	}
}

export { Api };
