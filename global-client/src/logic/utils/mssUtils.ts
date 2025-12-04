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
