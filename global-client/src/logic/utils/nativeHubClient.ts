// In the native app, hub-client is bundled into the app instead of being fetched live from the hub's domain
// (see hub-client/public/client-config.js), and served on an origin of its own for each hub
// (see hub-client/src/logic/utils/nativeHubOrigin.ts).
import { Capacitor } from '@capacitor/core';

import { nativeHubOrigin } from '@hub-client/logic/utils/nativeHubOrigin';

import { type Hub } from '@global-client/models/Hubs';

type HubAddress = Pick<Hub, 'hubId' | 'url' | 'serverUrl'>;

// The origin the hub's client runs on, which the messagebox handshake with its iframes must match.
function hubClientOrigin(hub: HubAddress): string {
	return Capacitor.isNativePlatform() ? nativeHubOrigin(hub.hubId, window.location.protocol) : hub.url;
}

function hubIndexBase(hub: HubAddress): string {
	return Capacitor.isNativePlatform() ? `${hubClientOrigin(hub)}/hub/index.html` : hub.url;
}

function hubMiniclientBase(hub: HubAddress): string {
	return Capacitor.isNativePlatform() ? `${hubClientOrigin(hub)}/hub/miniclient.html` : `${hub.url}/miniclient.html`;
}

// matrix-js-sdk strips a trailing slash from baseUrl internally, but hub-client's authentication.ts
// compares against the un-normalized value to detect a failed client creation. A trailing slash (e.g.
// hub.serverUrl always has one) makes that comparison spuriously fail and login() silently return false.
function hubMatrixApiUrl(serverUrl: string): string {
	return serverUrl.replace(/\/$/, '');
}

// In the native app the hub's origin does not fix which server its client talks to (that comes in through
// the iframe's query string), so the handshake has the client confirm it. See messagebox's startCommunication.
function hubHandshakeServerUrl(hub: HubAddress): string | undefined {
	return Capacitor.isNativePlatform() ? hubMatrixApiUrl(hub.serverUrl) : undefined;
}

export { hubClientOrigin, hubHandshakeServerUrl, hubIndexBase, hubMatrixApiUrl, hubMiniclientBase };
