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
	headers?: Object;
}

interface AllApiOptions {
	[index: string]: ApiOptions;
}

interface ApiDeleteResponse {
	deleted: string;
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
			this.apiURLS[key] = this.baseURL.concat('/', this.apiURLS[key]).replace(/[^:]\/\//g, '/');
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
			options.headers = {
				Authorization: 'Bearer ' + this.accessToken,
			};
		}
		const response = await fetch(url, options as RequestInit);
		if (!response.ok) {
			try {
				const result = await response.text();
				const json = JSON.parse(result);
				throw new Error(json.errors);
			} catch (error) {
				throw new Error(error as string);
			}
		}
		this.fetchEtagFromHeaders(response.headers);
		if (response.status == 204) {
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

	async apiDELETE(url: string, data: any): Promise<string> {
		const options = this.options.DELETE;
		options.body = JSON.stringify(data);
		const response = await this.api<ApiDeleteResponse>(url, options);
		return response.deleted;
	}
}

export { Api };
