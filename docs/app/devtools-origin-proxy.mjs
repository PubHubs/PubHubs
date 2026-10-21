// Attaches desktop Chromium DevTools to the app's WebView where chrome://inspect doesn't work, as on
// GrapheneOS (Vanadium WebView):
//
// - "inspect" returns 404: it loads the DevTools frontend for the WebView's exact revision from
//   chrome-devtools-frontend.appspot.com, which doesn't host Vanadium's revisions.
// - The bundled frontend gets "Debugging connection was closed": the WebView's DevTools server rejects
//   WebSocket connections that carry an Origin header unless started with --remote-allow-origins, and
//   Vanadium ignores /data/local/tmp/webview-command-line on user builds.
//
// This script listens on 127.0.0.1:9334, drops the Origin header, and forwards to port 9333.
//
// Usage:
//   adb forward tcp:9333 localabstract:webview_devtools_remote_$(adb shell pidof nl.pubhubs.client)
//   curl -s 127.0.0.1:9333/json | grep '"id"'
//   node docs/app/devtools-origin-proxy.mjs
// then type into Chromium's address bar:
//   devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9334/devtools/page/<id>
//
// Use 127.0.0.1, not localhost: the frontend's CSP only allows connect-src ws://127.0.0.1:*. The PID and
// page id change whenever the app restarts, so repeat the adb and curl steps then. Hub iframes are not
// separate targets; pick them in the Console's execution context dropdown (skip the "DevTools
// Performance Metrics" entries).
import net from 'node:net';

const handle = (client) => {
	let buffer = Buffer.alloc(0);
	const onData = (chunk) => {
		buffer = Buffer.concat([buffer, chunk]);
		const end = buffer.indexOf('\r\n\r\n');
		if (end < 0) return;
		client.off('data', onData);
		const head = buffer
			.subarray(0, end)
			.toString('latin1')
			.split('\r\n')
			.filter((line) => !/^origin:/i.test(line))
			.join('\r\n');
		const upstream = net.connect(9333, '127.0.0.1', () => {
			upstream.write(head + '\r\n\r\n');
			upstream.write(buffer.subarray(end + 4));
			client.pipe(upstream).pipe(client);
		});
		upstream.on('error', () => client.destroy());
		client.on('error', () => upstream.destroy());
	};
	client.on('data', onData);
};

net.createServer(handle).listen(9334, '127.0.0.1');
console.log('Open devtools://devtools/bundled/inspector.html?ws=127.0.0.1:9334/devtools/page/<id>');
