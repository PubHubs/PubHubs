// Packages
import { Capacitor, type PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { watch } from 'vue';
import type { Router } from 'vue-router';

// Logic
import { phc_api } from '@global-client/logic/core/api';
import { BLOB_VERSION, type PushTarget, base64UrlEncode, encryptPushBlob, openSealedTag, randomId } from '@global-client/logic/pushBlob';
import { handleErrors } from '@global-client/logic/utils/mssUtils';

import { Api } from '@hub-client/logic/core/apiCore';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { type Hub } from '@global-client/models/Hubs';
import { type ErrorCode, type Result } from '@global-client/models/MSS/TGeneral';

// Stores
import { useGlobal } from '@global-client/stores/global';
import { useHubs } from '@global-client/stores/hubs';

const logger = createLogger('NativePush');

/**
 * Native push notifications, through the app's own "NativePush" plugin: APNs on iOS
 * (ios/App/App/NativePushPlugin.swift), FCM in Android's gplay build and UnifiedPush in its fdroid
 * build (android/app/src/{gplay,fdroid}/java/nl/pubhubs/client/push/).
 *
 * Hubs must not be able to link a user by their device's push token, so no hub ever gets it. Per hub,
 * the app registers a Matrix pusher with a random pushkey and, in its data, a "blob": the token
 * encrypted for PHC together with a random tag for that hub. The hub relays the blob through the
 * transcryptor to PHC (pubhubs_hub/modules/pubhubs/_push_gateway_proxy.py), so PHC can read the
 * token but doesn't learn the hub. PHC pushes just the tag, sealed afresh every time with this
 * device's tag key (also in the blob), so Apple and Google can't tell which pushes come from the same
 * hub. This module opens the sealed tag, maps it back to the hub, and opens that. See
 * pubhubs/src/servers/phc/push.rs.
 */

type DeviceToken = { transport: 'apns' | 'fcm'; token: string } | { transport: 'webpush'; token: string; p256dh: string; auth: string };

type NativePushPlugin = {
	/** Asks for permission and registers; the token arrives as "pushTokenReceived". Always resolves.
	 *  `vapid` is PHC's VAPID key, needed by UnifiedPush. */
	register(options: { vapid: string }): Promise<void>;
	addListener(eventName: 'pushTokenReceived', listenerFunc: (event: DeviceToken) => void): Promise<PluginListenerHandle>;
	addListener(eventName: 'pushUnavailable', listenerFunc: (event: { reason: string }) => void): Promise<PluginListenerHandle>;
	/** The user tapped a push notification. Not fired for pushes that merely arrive: navigating then would take the user away from what they're doing. */
	addListener(eventName: 'pushTapped', listenerFunc: (event: { sealed_tag: string }) => void): Promise<PluginListenerHandle>;
};

const NativePush = registerPlugin<NativePushPlugin>('NativePush');

/** Returned by PHC's `.ph/push/info`. */
type PushInfo = { blob_key: string; blob_key_id: string; vapid_key: string };

/** This device's pusher on one hub. */
type HubPusher = {
	pushkey: string;
	tag: string;
	/** Changes when the pusher must be registered again (see registrationId). */
	registrationId: string;
};

/** Local to this device, never synced: the token identifies the device, the pushers the hubs. */
const DEVICE_KEY = 'nativePushDevice';
const PUSHERS_KEY = 'nativePushPushers';
/** One per device, in every blob: PHC seals the tag with it. */
const TAG_KEY_KEY = 'nativePushTagKey';

/** One app id for every platform: which one would tell hubs something. */
const APP_ID = 'nl.pubhubs.client';

/** How long a push tap waits for an unknown hub to show up in the hub list (e.g. on first start). */
const HUB_WAIT_MS = 15_000;

type AuthenticatedHub = { hubId: string; accessToken: string; serverUrl: string };

let pushInfo: PushInfo | undefined;

function load<T>(key: string): T | undefined {
	try {
		return JSON.parse(localStorage.getItem(key) ?? 'null') ?? undefined;
	} catch {
		return undefined;
	}
}

function loadPushers(): Record<string, HubPusher> {
	return load<Record<string, HubPusher>>(PUSHERS_KEY) ?? {};
}

function savePushers(pushers: Record<string, HubPusher>): void {
	localStorage.setItem(PUSHERS_KEY, JSON.stringify(pushers));
}

/** This device's tag key, made the first time it's needed. */
function tagKey(): string {
	let key = load<string>(TAG_KEY_KEY);
	if (!key) {
		key = randomId(32);
		localStorage.setItem(TAG_KEY_KEY, JSON.stringify(key));
	}
	return key;
}

/** The hub's own push gateway, at the Push Gateway API's standard path under the hub's address. */
function pushGatewayUrl(serverUrl: string): string {
	return `${serverUrl}_matrix/push/v1/notify`;
}

/** Every hub the user is currently logged in to, with what's needed to call its Matrix API. */
function authenticatedHubs(): AuthenticatedHub[] {
	const hubs = useHubs();
	return useGlobal().pinnedHubs.flatMap((pinned) => {
		const serverUrl = hubs.hub(pinned.hubId)?.serverUrl;
		return pinned.accessToken && serverUrl ? [{ hubId: pinned.hubId, accessToken: pinned.accessToken, serverUrl }] : [];
	});
}

/**
 * Changes whenever a hub's pusher must be registered again: another device token, PHC key or blob
 * format, another hub address, or another login (Synapse deletes a pusher with the access token it
 * was made with). Hashed, as this is stored.
 */
async function registrationId(hub: AuthenticatedHub, device: DeviceToken, info: PushInfo): Promise<string> {
	// The device's fields one by one, not the object: the native side sends them in no fixed order
	// (iOS's dictionaries), and a different order must not count as a new token. Otherwise the app
	// would register again on every hub at every start, which hubs could use to link a user.
	const deviceFields = device.transport === 'webpush' ? [device.transport, device.token, device.p256dh, device.auth] : [device.transport, device.token];
	const input = new TextEncoder().encode(JSON.stringify([BLOB_VERSION, info.blob_key_id, deviceFields, hub.serverUrl, hub.accessToken]));
	return base64UrlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}

function pushTarget(device: DeviceToken, tag: string): PushTarget {
	const tag_key = tagKey();
	return device.transport === 'webpush'
		? { transport: 'webpush', endpoint: device.token, p256dh: device.p256dh, auth: device.auth, tag, tag_key }
		: { transport: device.transport, token: device.token, tag, tag_key };
}

function matrixApi(hub: AuthenticatedHub): Api {
	const api = new Api(hub.serverUrl, { pushersSet: '_matrix/client/v3/pushers/set' });
	api.setAccessToken(hub.accessToken);
	return api;
}

/** Registers (or updates) this device's pusher on `hub`, unless that's already done. */
async function registerPusher(hub: AuthenticatedHub, device: DeviceToken, info: PushInfo): Promise<void> {
	const pusher = loadPushers()[hub.hubId] ?? { pushkey: randomId(), tag: randomId(), registrationId: '' };
	const id = await registrationId(hub, device, info);
	if (pusher.registrationId === id) return;

	const api = matrixApi(hub);
	try {
		await api.apiPOST(api.apiURLS.pushersSet, {
			app_id: APP_ID,
			app_display_name: 'PubHubs',
			device_display_name: 'PubHubs',
			pushkey: pusher.pushkey,
			kind: 'http',
			lang: 'en',
			data: {
				url: pushGatewayUrl(hub.serverUrl),
				// Synapse then only sends ids to the gateway, which only passes on the blob anyway.
				format: 'event_id_only',
				blob: await encryptPushBlob(info.blob_key, pushTarget(device, pusher.tag)),
			},
			append: false,
		});
		savePushers({ ...loadPushers(), [hub.hubId]: { ...pusher, registrationId: id } });
		logger.info(`registered pusher for hub ${hub.hubId}`);
	} catch (error) {
		logger.error(`failed to register the pusher for hub ${hub.hubId}: ${error}`);
	}
}

/** Deletes this device's pusher on a hub the user unpinned, with the access token it still had. */
async function deletePusher(hub: AuthenticatedHub): Promise<void> {
	const pushers = loadPushers();
	const pusher = pushers[hub.hubId];
	if (!pusher) return;
	delete pushers[hub.hubId];
	savePushers(pushers);

	const api = matrixApi(hub);
	try {
		await api.apiPOST(api.apiURLS.pushersSet, { app_id: APP_ID, pushkey: pusher.pushkey, kind: null });
		logger.info(`deleted pusher for hub ${hub.hubId}`);
	} catch (error) {
		// Logging out of the hub deletes the pusher too.
		logger.warn(`failed to delete the pusher for hub ${hub.hubId}: ${error}`);
	}
}

let syncing: Promise<void> = Promise.resolve();

/**
 * Brings every logged-in hub's pusher up to date. Calls are queued, so two syncs never register the same
 * hub at once and a new hub gets one pushkey and tag; within a sync the hubs are done in parallel.
 */
function syncPushers(): Promise<void> {
	syncing = syncing.then(async () => {
		const device = load<DeviceToken>(DEVICE_KEY);
		const info = pushInfo;
		if (!device || !info) return;
		await Promise.all(authenticatedHubs().map((hub) => registerPusher(hub, device, info)));
	});
	return syncing;
}

/** How long a hub must stay unpinned before its pusher is deleted: settings reloads briefly empty the list. */
const UNPIN_GRACE_MS = 5_000;

/**
 * Registers pushers for hubs the user logs in to, and deletes them for hubs the user unpins. A hub that
 * only loses its access token (e.g. while settings load) keeps its pusher: logging out of the hub
 * deletes it on the hub's side anyway, and a new login registers again.
 */
function trackAuthenticatedHubs(): void {
	watch(
		authenticatedHubs,
		(current, previous) => {
			void syncPushers();
			const currentIds = new Set(current.map((hub) => hub.hubId));
			for (const hub of previous ?? []) {
				if (currentIds.has(hub.hubId)) continue;
				setTimeout(() => {
					if (!useGlobal().pinnedHubs.some((pinned) => pinned.hubId === hub.hubId)) void deletePusher(hub);
				}, UNPIN_GRACE_MS);
			}
		},
		{ deep: true, immediate: true },
	);
}

/** The hub with `hubId`, waiting a while if the hub list hasn't got it yet (a tap can cold-start the app). */
function whenHubKnown(hubId: string): Promise<Hub | undefined> {
	const hubs = useHubs();
	const known = hubs.hub(hubId);
	if (known) return Promise.resolve(known);

	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			stop();
			resolve(undefined);
		}, HUB_WAIT_MS);
		const stop = watch(
			() => hubs.hub(hubId),
			(hub) => {
				if (!hub) return;
				clearTimeout(timer);
				stop();
				resolve(hub);
			},
		);
	});
}

/** A push notification was tapped: open its hub, as clicking it would, unless the user is already in it (keeping the room they're in). */
async function openHub(router: Router, sealedTag: string): Promise<void> {
	const tag = await openSealedTag(tagKey(), sealedTag);
	const hubId = tag && Object.entries(loadPushers()).find(([, pusher]) => pusher.tag === tag)?.[0];
	if (!hubId) {
		logger.warn('push for an unknown tag');
		return;
	}
	logger.info(`push for hub ${hubId}`);
	const hub = await whenHubKnown(hubId);
	if (!hub) return;
	const current = router.currentRoute.value;
	if (current.name === 'hub' && current.params.name === hub.name) return;
	await router.push({ name: 'hub', params: { name: hub.name } });
}

/** Call once, after the router is available (App.vue). Does nothing on the web, where Notification and Sliding Sync already cover this. */
async function initNativePush(router: Router): Promise<void> {
	if (!Capacitor.isNativePlatform() || !phc_api) return;
	const phc = phc_api;

	await NativePush.addListener('pushTapped', ({ sealed_tag }) => void openHub(router, sealed_tag));
	await NativePush.addListener('pushUnavailable', ({ reason }) => logger.warn(`unavailable (${reason})`));
	await NativePush.addListener('pushTokenReceived', (device) => {
		logger.info(`device token received (${device.transport})`);
		localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
		void syncPushers();
	});

	try {
		pushInfo = await handleErrors<PushInfo>(() => phc.apiGET<Result<PushInfo, ErrorCode>>(phc.apiURLS.pushInfo));
	} catch (error) {
		// Pushers stay as they are; the next start tries again.
		logger.warn(`could not get PHC's push keys: ${error}`);
		return;
	}

	trackAuthenticatedHubs();
	await NativePush.register({ vapid: pushInfo.vapid_key });
}

export { initNativePush };
