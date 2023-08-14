/**
 *
 * This store has generic API functions for hub and global
 *
 */

import { defineStore } from 'pinia';

interface ApiOptions {
	method: string;
	body?: string;
	headers?: Object;
}

interface ApiDeleteResponse {
	deleted: string;
}

const apiOptionsGET: ApiOptions = {
	method: 'GET',
};

const apiOptionsPOST: ApiOptions = {
	method: 'POST',
};

const apiOptionsPUT: ApiOptions = {
	method: 'PUT',
};

const apiOptionsDELETE: ApiOptions = {
	method: 'DELETE',
};

const useApi = defineStore('api', {
	state: () => {
		return {
			etag: '',
			accessToken: '',
		};
	},

	actions: {
		setAccessToken(token: string) {
			this.accessToken = token;
		},

		fetchEtagFromHeaders(headers: Headers): string {
			if (headers.get('etag')) {
				this.etag = headers.get('etag') as string;
			}
			return this.etag;
		},

		isJsonResponse(headers: Headers): boolean {
			if (headers.get('content-type') == 'application/json') {
				return true;
			}
			const contentLength = headers.get('content-length');
			if (headers.get('content-type') == 'application/octet-stream' && contentLength !== null && contentLength != '0') {
				return true;
			}
			return false;
		},

		async api<T>(url: string, options: ApiOptions = apiOptionsGET, defaultResponseData: any = undefined): Promise<T> {
			if (this.accessToken) {
				options.headers = {
					Authorization: 'Bearer ' + this.accessToken,
				};
			}
			const response = await fetch(url, options as RequestInit);
			if (!response.ok) {
				const result = await response.json();
				throw new Error(result.errors);
			}
			this.fetchEtagFromHeaders(response.headers);
			if (response.status == 204) {
				return true as T;
			}
			if (this.isJsonResponse(response.headers)) {
				return response.json() as Promise<T>;
			}
			return defaultResponseData as T;
		},

		async apiGET<T>(url: string): Promise<T> {
			return this.api<T>(url, apiOptionsGET);
		},

		async apiPOST<T>(url: string, data: any): Promise<T> {
			const options = apiOptionsPOST;
			options.body = JSON.stringify(data);
			return this.api<T>(url, options);
		},

		async apiPUT<T>(url: string, data: any, etag: boolean = false): Promise<T> {
			const options = apiOptionsPUT;
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
		},

		async apiDELETE(url: string, data: any): Promise<string> {
			const options = apiOptionsDELETE;
			options.body = JSON.stringify(data);
			const response = await this.api<ApiDeleteResponse>(url, options);
			return response.deleted;
		},
	},
});

export { apiOptionsGET, apiOptionsPOST, apiOptionsPUT, apiOptionsDELETE, useApi };
