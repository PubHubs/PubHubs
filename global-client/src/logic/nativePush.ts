// Packages
import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { watch } from 'vue';
import type { Router } from 'vue-router';

// Logic
import { Api } from '@hub-client/logic/core/apiCore';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

const logger = createLogger('NativePush');

/**
 * JS-facing glue for the native "NativePush" Capacitor plugin - one implementation per platform
 * (android/app/src/gplay/.../push/NativePushPlugin.java for FCM, .../fdroid/.../push/NativePushPlugin.java
 * for UnifiedPush, ios/App/App/NativePushPlugin.swift for APNs), all sharing this one contract so
 * this file never needs to know which platform/flavor it's running on.
 *
 * Every push is a data-only wake-up signal carrying nothing but an opaque `hub_id` - never a room,
 * event, sender, or message. This module never treats a push as a data source itself: receiving
 * one only tells the app which hub to open/refresh, exactly like tapping the hub normally would.
 * See the push notifications plan for the full design.
 */

type PushTokenReceivedEvent = { transport: string; token: string };
type PushUnavailableEvent = { reason: string };
type PushReceivedEvent = { hub_id: string };

type NativePushPlugin = {
	/** Fire-and-forget: requests the notification permission, then kicks off async registration.
	 *  Always resolves - failures surface via the "pushUnavailable" event instead of a rejection. */
	register(): Promise<void>;
	addListener(eventName: 'pushTokenReceived', listenerFunc: (event: PushTokenReceivedEvent) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'pushUnavailable', listenerFunc: (event: PushUnavailableEvent) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'pushReceived', listenerFunc: (event: PushReceivedEvent) => void): Promise<PluginListenerHandle>;
};

const NativePush = registerPlugin<NativePushPlugin>('NativePush');

/** Device push token, persisted locally: it identifies *this device*, never synced across
 *  devices via PHC's globalsettings object (unlike the rest of GlobalSettings) - same reasoning
 *  as `PHauthToken` being kept in plain localStorage rather than that synced object. */
const STORAGE_KEY = 'nativePushToken';

type DeviceToken = { transport: string; token: string };

/**
 * Matrix `app_id` for pushers/set, one per native build variant. Must match the app_id each
 * flavor's Java/Swift plugin implicitly assumes on the server side.
 */
const APP_ID_BY_TRANSPORT: Record<string, string> = {
	fcm: 'nl.pubhubs.client.gplay',
	unifiedpush: 'nl.pubhubs.client.fdroid',
	apns: 'nl.pubhubs.client.ios',
};

function loadDeviceToken(): DeviceToken | null {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as DeviceToken;
	} catch {
		return null;
	}
}

function storeDeviceToken(deviceToken: DeviceToken | null): void {
	if (deviceToken) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(deviceToken));
	} else {
		localStorage.removeItem(STORAGE_KEY);
	}
}

/**
 * Always the hub's own push gateway, reverse-proxied under the hub's own domain at the Matrix
 * Push Gateway API's standard path - never a shared/third-party gateway, see the push
 * notifications plan. This means no separate discovery mechanism is needed: any hub that wants
 * push support just needs to route this one path to its own Sygnal instance.
 */
function pushGatewayUrl(serverUrl: string): string {
	return `${serverUrl}_matrix/push/v1/notify`;
}

/**
 * Registers or deletes the Matrix pusher identifying `deviceToken` for one hub.
 *
 * NEEDS VERIFICATION once a real hub push gateway (Sygnal) exists to test against: for the
 * "unifiedpush" transport, `pushkey` below is the UnifiedPush endpoint URL the OS handed back.
 * Whether Sygnal's webpush pushkin accepts that as `pushkey` verbatim, or expects it encoded
 * differently, is unconfirmed - see the push notifications plan's "spike this early" note on
 * Sygnal + UnifiedPush.
 */
async function setPusher(hubId: string, hubAccessToken: string, serverUrl: string, deviceToken: DeviceToken, remove: boolean): Promise<void> {
	const appId = APP_ID_BY_TRANSPORT[deviceToken.transport];
	if (!appId) {
		logger.error(`unknown transport '${deviceToken.transport}', not touching the pusher for hub ${hubId}`);
		return;
	}

	const api = new Api(serverUrl, { pushersSet: '_matrix/client/v3/pushers/set' });
	api.setAccessToken(hubAccessToken);

	const body = remove
		? { app_id: appId, pushkey: deviceToken.token, kind: null }
		: {
				app_id: appId,
				app_display_name: 'PubHubs',
				device_display_name: 'PubHubs',
				pushkey: deviceToken.token,
				kind: 'http',
				lang: 'en',
				// event_id_only: Synapse strips everything but room_id/event_id before forwarding to the
				// gateway. The hub's gateway proxy enforces this too, and itself adds the hub_id (and
				// for iOS the generic alert) every platform's push carries - see
				// pubhubs_hub/modules/pubhubs/_push_gateway_proxy.py's sanitize_notification().
				data: { url: pushGatewayUrl(serverUrl), format: 'event_id_only' },
				append: false,
			};

	try {
		await api.apiPOST(api.apiURLS.pushersSet, body);
		logger.info(`${remove ? 'deleted' : 'registered'} pusher for hub ${hubId} (transport=${deviceToken.transport})`);
	} catch (error) {
		logger.error(`failed to ${remove ? 'delete' : 'register'} the pusher for hub ${hubId}: ${error}`);
	}
}

type AuthenticatedHub = { hubId: string; accessToken: string; serverUrl: string };

/** Every hub the user is currently authenticated against, with what's needed to call its Matrix API. */
function authenticatedHubs(): AuthenticatedHub[] {
	const global = useGlobal();
	const hubs = useHubs();
	const result: AuthenticatedHub[] = [];
	for (const pinned of global.pinnedHubs) {
		if (!pinned.accessToken) continue;
		const serverUrl = hubs.hub(pinned.hubId)?.serverUrl;
		if (!serverUrl) continue;
		result.push({ hubId: pinned.hubId, accessToken: pinned.accessToken, serverUrl });
	}
	return result;
}

/**
 * Reacts to hubs gaining or losing an authenticated access token (login/logout, pin/unpin),
 * registering or deleting that hub's pusher accordingly - using whatever device token is
 * currently known. A hub with no device token known yet is simply skipped for now; it catches up
 * once `onTokenReceived` below runs.
 *
 * A hub that *loses* its access token needs the token it *had* (still valid at the moment it was
 * removed) to authenticate the deletion call - watch()'s previous-value argument gives us exactly
 * that, which a naive "re-check current state" approach could not.
 */
function trackAuthenticatedHubs(): void {
	watch(
		authenticatedHubs,
		(current, previous) => {
			const deviceToken = loadDeviceToken();
			if (!deviceToken) return;

			const previousById = new Map((previous ?? []).map((hub) => [hub.hubId, hub]));
			const currentIds = new Set(current.map((hub) => hub.hubId));

			for (const hub of current) {
				const before = previousById.get(hub.hubId);
				if (!before || before.accessToken !== hub.accessToken) {
					void setPusher(hub.hubId, hub.accessToken, hub.serverUrl, deviceToken, false);
				}
			}

			for (const before of previous ?? []) {
				if (!currentIds.has(before.hubId)) {
					void setPusher(before.hubId, before.accessToken, before.serverUrl, deviceToken, true);
				}
			}
		},
		{ deep: true, immediate: true },
	);
}

/** A new (or refreshed) device token arrived: register it for every authenticated hub, and
 *  best-effort clean up the previous token's pusher on each of them if it changed. */
async function onTokenReceived(deviceToken: DeviceToken): Promise<void> {
	logger.info(`token received (transport=${deviceToken.transport})`);
	const previous = loadDeviceToken();
	storeDeviceToken(deviceToken);

	const hubs = authenticatedHubs();
	await Promise.all(hubs.map((hub) => setPusher(hub.hubId, hub.accessToken, hub.serverUrl, deviceToken, false)));

	if (previous && (previous.transport !== deviceToken.transport || previous.token !== deviceToken.token)) {
		await Promise.all(hubs.map((hub) => setPusher(hub.hubId, hub.accessToken, hub.serverUrl, previous, true)));
	}
}

/**
 * Call once, after the router is available (see `global-client/src/pages/App.vue`). No-ops on
 * the web (browser Notification API + Sliding Sync already cover that case, see hubs.ts's
 * `sendNotification`, left untouched by this module).
 */
function initNativePush(router: Router): void {
	if (!Capacitor.isNativePlatform()) return;

	logger.debug('initNativePush: registering');
	trackAuthenticatedHubs();

	NativePush.addListener('pushTokenReceived', ({ transport, token }) => {
		void onTokenReceived({ transport, token });
	});

	NativePush.addListener('pushUnavailable', ({ reason }) => {
		// "no_distributor" (fdroid, no UnifiedPush app installed) and "vapid_required" are the
		// reasons most worth a user-facing prompt eventually; left as a log line for now - wiring
		// up that UI is a separate piece of work from getting the mechanism working.
		logger.warn(`unavailable (${reason})`);
	});

	NativePush.addListener('pushReceived', ({ hub_id }) => {
		logger.info(`push received (hub_id=${hub_id})`);
		const hub = useHubs().hub(hub_id);
		if (!hub) return;
		// Same route a user clicking the hub in the UI would take (see HubBlock.vue/HubMenu.vue) -
		// the hub's own Sliding Sync then fetches the real unread state; the push is never itself a
		// data source.
		void router.push({ name: 'hub', params: { name: hub.name } });
	});

	void NativePush.register();
}

export { initNativePush };
