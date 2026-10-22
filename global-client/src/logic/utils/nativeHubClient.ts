// In the native app, hub-client is bundled into the app instead of being fetched live from the hub's domain
// (see hub-client/public/client-config.js), and served on an origin of its own for each hub
// (see hub-client/src/logic/utils/nativeHubOrigin.ts).
import { Capacitor } from '@capacitor/core';

import { createLogger } from '@hub-client/logic/logging/Logger';
import { nativeHubOrigin } from '@hub-client/logic/utils/nativeHubOrigin';

import { type Hub } from '@global-client/models/Hubs';

import { useLocalStores } from '@global-client/stores/localStores';

import { type HandshakeOptions } from '@hub-client/stores/messagebox';

const logger = createLogger('NativeHubClient');

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

// Extra handshake data for the hub's iframes, native app only (see HandshakeOptions in messagebox.ts):
// the hub server url the hub-client must confirm, and the key for the hub's own encrypted storage. The
// key is left out when the user secret is not available; the hub then keeps its data in memory.
async function hubHandshakeOptions(hub: HubAddress): Promise<HandshakeOptions> {
	if (!Capacitor.isNativePlatform()) return {};
	const hubServerUrl = hubMatrixApiUrl(hub.serverUrl);
	try {
		const localStores = await useLocalStores().retrieve();
		return { hubServerUrl, hubStorageKey: localStores ? await localStores.hubStorageKey(hub.hubId) : undefined };
	} catch (error) {
		logger.warn('Could not derive the hub storage key; the hub keeps its data in memory', { error });
		return { hubServerUrl };
	}
}

export { hubClientOrigin, hubHandshakeOptions, hubIndexBase, hubMatrixApiUrl, hubMiniclientBase };
