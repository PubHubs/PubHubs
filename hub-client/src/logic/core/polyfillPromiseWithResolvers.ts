// `Promise.withResolvers()` is a recent addition (Safari 17.4, Chrome 119) that `matrix-js-sdk` uses
// pervasively. On an older WKWebView, sending a message throws "Promise.withResolvers is not a
// function". See docs/app/README.md.
//
// Imported as the very first statement in main.ts, well before matrix-js-sdk is ever called at runtime.
//
// This is the exact polyfill from the spec/MDN — a no-op wherever the native implementation exists.
if (typeof Promise.withResolvers !== 'function') {
	Promise.withResolvers = function <T>() {
		let resolve!: (value: T | PromiseLike<T>) => void;
		let reject!: (reason?: unknown) => void;
		const promise = new Promise<T>((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	};
}
