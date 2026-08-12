// `Promise.withResolvers()` is a recent addition (Safari 17.4, Chrome 119) that `matrix-js-sdk` uses pervasively.
// On an older WKWebView (below iOS 17), sending a message throws "Promise.withResolvers is not a function". See docs/app/README.md.
//
// Loaded as a plain, unbundled script (like client-config.js below) so it always runs before any of hub-client's module code, regardless of import order.
//
// This is the exact polyfill from the spec / MDN — a no-op wherever the native implementation already
// exists.
if (typeof Promise.withResolvers !== 'function') {
	Promise.withResolvers = function () {
		let resolve, reject;
		const promise = new Promise((res, rej) => {
			resolve = res;
			reject = rej;
		});
		return { promise, resolve, reject };
	};
}
