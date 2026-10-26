/**
 * Telling "the server could not be reached" apart from "the server said no".
 *
 * Code that handles a failed request must not take a destructive step (log out, drop tokens, fall
 * back to defaults, show an error page) on a network error: the state it would throw away is most
 * likely still valid. See docs/app/offline.md.
 */

/** A request that never got an answer: no network, an unreachable server, or a timeout. */
class NetworkError extends Error {
	readonly url: string;

	constructor(url: string, cause?: unknown) {
		super(`Could not reach ${url}`, { cause });
		this.name = 'NetworkError';
		this.url = url;
	}
}

// fetch() rejects with a TypeError when a request never got an answer; the message differs per
// engine (Chromium, WebKit, Firefox, React Native / older polyfills).
const FETCH_FAILURE_MESSAGE = /Failed to fetch|Load failed|NetworkError|Network request failed/i;

function isNetworkError(error: unknown): boolean {
	if (error instanceof NetworkError) return true;
	if (typeof error !== 'object' || error === null) return false;
	const name = (error as { name?: unknown }).name;
	// matrix-js-sdk wraps a failed fetch in its own ConnectionError. AbortSignal.timeout() gives up on
	// a request that got no answer in time with a TimeoutError (a DOMException, not always an Error).
	if (name === 'ConnectionError' || name === 'TimeoutError') return true;
	return error instanceof TypeError && FETCH_FAILURE_MESSAGE.test(error.message);
}

export { isNetworkError, NetworkError };
