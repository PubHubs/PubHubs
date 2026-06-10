// Types
type ApiUrls = {
	[index: string]: string;
};

type ApiOptions = {
	method: string;
	body?: string | Uint8Array;
	headers?: Record<string, string>;
};

type AllApiOptions = {
	[index: string]: ApiOptions;
};

type ApiErrorResponse = {
	errcode?: string;
	error?: string;
	retry_after_ms?: number;
};

class ApiError extends Error {
	public errcode?: string;
	public retry_after_ms?: number;
	public status: number;

	constructor(message: string, status: number, response?: ApiErrorResponse) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.errcode = response?.errcode;
		this.retry_after_ms = response?.retry_after_ms;
	}
}

class Api {
	baseURL: string;
	apiURLS: ApiUrls;
	etag: string;
	accessToken: string;
	options: AllApiOptions;
	private onUnauthorized?: () => void;

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

	/**
	 * Set a callback to be invoked when a 401 Unauthorized response is received.
	 * This is used to trigger re-authentication when the access token is invalid.
	 */
	setOnUnauthorized(callback: () => void) {
		this.onUnauthorized = callback;
	}

	fetchEtagFromHeaders(headers: Headers): string {
		if (headers.get('etag')) {
			this.etag = headers.get('etag') as string;
		}
		return this.etag;
	}

	async api<T>(url: string, options: ApiOptions = this.options.GET): Promise<T> {
		if (this.accessToken) {
			options.headers = { ...options.headers, Authorization: 'Bearer ' + this.accessToken };
		}
		// console.log(url);
		const response = await fetch(url, options as RequestInit);
		if (!response.ok) {
			// Handle 401 Unauthorized - trigger re-authentication
			if (response.status === 401 && this.onUnauthorized) {
				this.onUnauthorized();
			}
			try {
				const result = await response.text();
				const json = JSON.parse(result) as ApiErrorResponse;
				const message = json.error ?? json.errcode ?? result;
				throw new ApiError(message, response.status, json);
			} catch (error: unknown) {
				if (error instanceof ApiError) {
					throw error;
				}
				throw new ApiError(error instanceof Error ? error.message : String(error), response.status);
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

	async apiPOST<T>(url: string, data: unknown): Promise<T> {
		const options = this.options.POST;
		options.body = JSON.stringify(data);
		return this.api<T>(url, options);
	}

	async apiPUT<T>(url: string, data: unknown, etag: boolean = false): Promise<T> {
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

	async apiDELETE<T>(url: string, data?: unknown): Promise<T> {
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
			// Handle 401 Unauthorized - trigger re-authentication
			if (response.status === 401 && this.onUnauthorized) {
				this.onUnauthorized();
			}
			// The backend returns a JSON body like {"message": "File type not allowed."}.
			// Surface that message so callers can show the specific reason to the user.
			let message = '';
			try {
				const body = await response.json();
				message = body?.message ?? '';
			} catch {
				message = await response.text();
			}
			throw new Error(message || `Failed to upload file (status ${response.status})`);
		}
	}
}

export { Api, ApiError };
