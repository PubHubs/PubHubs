// Logic
import { delay } from '@global-client/logic/utils/generalUtils';

// Models
import { ErrorCode, Result, isOk } from '@global-client/models/MSS/TGeneral';

// Use function overloads to specify different return types based on input (return type T instead of T | ArrayBuffer if response is a Result type)
export function handleErrorCodes<T, E = ErrorCode>(response: Result<T, E>): T;

export function handleErrorCodes<T, E = ErrorCode>(response: Result<T, E> | ArrayBuffer): T | ArrayBuffer;

export function handleErrorCodes<T, E = ErrorCode>(response: Result<T, E> | ArrayBuffer): T | ArrayBuffer {
	if (response instanceof ArrayBuffer) {
		return response;
	}
	if (isOk(response)) {
		return response.Ok;
	} else {
		if (!response?.Err) {
			throw new Error('The global-client received an undefined response in handleErrorCodes');
		}
		throw new Error(String(response.Err));
	}
}

// Use function overloads to specify different return types based on input (return type Promise<T> instead of Promise<T | ArrayBuffer> if apiCallFn returns a Result type)
export async function handleErrors<T>(apiCallFn: () => Promise<Result<T, ErrorCode>>, maxRetries?: number): Promise<T>;

export async function handleErrors<T>(apiCallFn: () => Promise<Result<T, ErrorCode> | ArrayBuffer>, maxRetries?: number): Promise<T | ArrayBuffer>;

export async function handleErrors<T>(apiCallFn: () => Promise<Result<T, ErrorCode> | ArrayBuffer>, maxRetries = 4): Promise<T | ArrayBuffer> {
	for (let retry = 0; retry < maxRetries; retry++) {
		try {
			const response = await apiCallFn();
			return handleErrorCodes<T>(response);
		} catch (error) {
			if (error instanceof Error && error.message === ErrorCode.PleaseRetry) {
				delay(retry);
				continue;
			}
			throw error;
		}
	}
	throw new Error(ErrorCode.PleaseRetry);
}
/**
 * Converts a base64url encoded string into a standard base64 string.
 *
 * @param base64Url The base64 url (unpadded) encoded string.
 * @returns The standard base64 string.
 */
export function base64fromBase64Url(base64Url: string) {
	// Change from base64url encoding to standard base64 encoding
	let base64 = base64Url.replaceAll('-', '+').replaceAll('_', '/');
	// Add padding to make sure the length of the base64 encoded string is a multiple of 4
	while (base64.length % 4) {
		base64 += '=';
	}
	return base64;
}

/**
 * Generate the options for a POST request to one of the API endpoints.
 *
 * @param requestBody What needs to be sent as the body of the request.
 * @returns The options that need to be sent with the POST request.
 */
export function requestOptions<T>(requestBody: T, authorization?: string | undefined) {
	return {
		body: JSON.stringify(requestBody),
		headers: { 'Content-Type': 'application/json', Authorization: authorization },
		method: 'POST',
	};
}

/**
 * A helper function to check whether the attributes the user disclosed are matching the attributes that were requested.
 *
 * @param attrTypes The list of attribute handles that were requested.
 * @param responseAttrs The list of attribute handles that were disclosed.
 * @returns True if the attributes are matching, false otherwise.
 */
export function responseEqualToRequested(responseAttrs: string[], attrTypes: readonly string[]): boolean {
	if (attrTypes.length !== responseAttrs.length) {
		return false;
	}

	const setA = new Set(attrTypes);
	const setB = new Set(responseAttrs);

	for (const value of setA) {
		if (!setB.has(value)) {
			return false;
		}
	}
	return true;
}
export function decodeJWT(jwt: string): any {
	try {
		// Only take the payload of the JWT
		const base64Url = jwt.split('.')[1];
		const base64 = base64fromBase64Url(base64Url);
		// Decode the base64 encoded string to a buffer (bytes) and parse this buffer as JSON
		const jsonPayload = Buffer.from(base64, 'base64').toString();
		return JSON.parse(jsonPayload);
	} catch {
		throw new Error('Invalid JWT');
	}
}
