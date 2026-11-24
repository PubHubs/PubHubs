<template>
	<iframe
		v-if="hubs.currentHubExists"
		:id="iframeHubId"
		title="hub"
		allow="camera; microphone; display-capture; autoplay; speaker-selection; clipboard-write; fullscreen"
		:src="hubUrl"
		class="h-full w-full"
		name="hub"
	></iframe>
</template>

<script lang="ts" setup>
	// Packages
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	import { cacheBust } from '@global-client/logic/utils/cacheBust';
	import { hubIndexBase, hubMatrixApiUrl } from '@global-client/logic/utils/nativeHubClient';

	import { isNetworkError } from '@hub-client/logic/core/networkError';
	import { createLogger } from '@hub-client/logic/logging/Logger';
	import { assert } from '@hub-client/logic/utils/assert';
	// Logic
	import { delay } from '@hub-client/logic/utils/common';

	import { type EnterStartResp } from '@global-client/models/MSS/TGeneral';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';
	import { useMSS } from '@global-client/stores/mss';

	import { iframeHubId } from '@hub-client/stores/messagebox';
	import { useSettings } from '@hub-client/stores/settings';

	const route = useRoute();
	const router = useRouter();
	const hubs = useHubs();
	const global = useGlobal();
	const settings = useSettings();
	const logger = createLogger('Hub');

	onMounted(onRouteChange);

	// Entering a hub takes a while (fetching it, the hub login), and the user can leave the page or move to another hub meanwhile.
	// Only the newest run (latest user action) may be shown.
	let currentRun = 0;

	onUnmounted(() => {
		currentRun++;
		hubs.changeHub({
			name: '',
			roomId: '',
		});
	});

	// The route also changes on the way out of this page, before it unmounts. That route is for the
	// page we are going to, which has no hub in it: treating it as a hub that does not exist would
	// send the user to the hubs overview instead.
	watch(route, () => {
		if (route.name === 'hub') onRouteChange();
	});

	const hubUrl = ref('');

	async function onRouteChange() {
		const runId = ++currentRun;
		const superseded = () => runId !== currentRun;
		// The route moves on with the user, so keep the one this run is for.
		const params = { ...route.params };
		const hubName = params.name as string;
		// Only pinned hubs are loaded at startup, so a hub the user has not pinned yet is fetched here.
		if (!hubs.hubId(hubName)) {
			try {
				await global.getHubData(hubName);
			} catch (error) {
				logger.error(`Could not load hub '${hubName}'`, { error });
			}
			if (superseded()) return;
		}
		let hubId = undefined;
		const maxAttempts = 4;
		for (let attempt = 0; attempt < maxAttempts && !hubId; attempt++) {
			try {
				hubId = hubs.hubId(hubName);
			} catch (error) {
				logger.error(`Could not execute function onRouteChange on attempt: ${attempt}`, { error });
			}
			if (!hubId) {
				await delay(attempt);
				if (superseded()) return;
			}
		}
		if (!hubId) {
			router.push({ name: 'hubs-overview' });
			return;
		}
		if (!hubs.hubExists(hubId)) {
			await hubs.changeHub({ id: '', roomId: '' });
			if (superseded()) return;
		}
		const authenticated = await handleHubAuth(hubId, superseded);
		if (!authenticated || superseded()) return;
		await hubs.changeHub(params);
		if (superseded()) return;
		settings.setLastVisitedHub(hubId);
	}

	/** Sets the iframe url for entering the hub. Returns whether that worked; if not, the user has been sent elsewhere already (or the run is superseded). */
	async function handleHubAuth(id: string, superseded: () => boolean): Promise<boolean> {
		const hub = hubs.hub(id);
		if (!hub) {
			logger.error(`Could not find hub '${id}'`);
			router.push({ name: 'hubs-overview' });
			return false;
		}
		const hubId = hub.hubId ?? '';
		const state = hubloggedinstatus(hubId);

		switch (state.kind) {
			case Status.GlobalNotLoggedIn:
				hubUrl.value = `${hubIndexBase(hub)}?${new URLSearchParams({ hubId, cb: cacheBust, HUB_URL: hubMatrixApiUrl(hub.serverUrl), PARENT_URL: window.location.origin })}#/hub/`;
				return true;
			case Status.MSSHubNotLoggedIn: {
				try {
					const maxAttempts = 4;
					for (let attempt = 0; attempt < maxAttempts; attempt++) {
						if (attempt > 0) {
							await delay(attempt - 1);
						}
						if (superseded()) return false;
						const mss = useMSS();
						const enterStartResp: EnterStartResp | undefined = await hub.enterStartEP();
						assert.isDefined(enterStartResp, 'Something went wrong receiving/handling the response from enterStartEP.');
						const hhpp = await mss.obtainHhpp(id, enterStartResp);
						assert.isDefined(hhpp, 'Something went wrong with getting the signedHhpp.');
						const enterCompleteResp = await hub.enterCompleteEP(enterStartResp.state, hhpp);
						if (enterCompleteResp === 'RetryFromStart' && attempt < maxAttempts - 1) continue;
						else if (enterCompleteResp === 'RetryFromStart') throw new Error('Max attempts for RetryFromStart were passed');
						assert.isDefined(enterCompleteResp, 'Something went wrong receiving/handling a response from enterCompleteEP.');
						if (superseded()) return false;
						const authInfo = JSON.stringify({
							token: enterCompleteResp.access_token,
							userId: enterCompleteResp.mxid,
						});
						// TODO make sure that accessToken is no longer passed in query parameter
						hubUrl.value = `${hubIndexBase(hub)}?${new URLSearchParams({ newToken: 'true', accessToken: authInfo, hubId, cb: cacheBust, HUB_URL: hubMatrixApiUrl(hub.serverUrl), PARENT_URL: window.location.origin })}`;
						return true;
					}
				} catch (error) {
					logger.error('Error during Hub MSS login', { error });
					if (superseded()) return false;
					// Entering a hub for the first time needs PHC and the hub; say so rather than show an error.
					router.push(isNetworkError(error) ? { name: 'error', query: { errorKey: 'errors.needs_connection' } } : { name: 'error' });
				}
				return false;
			}
			case Status.MSSAccessToken: {
				const authInfo = JSON.stringify({
					token: state.token,
					userId: state.userId,
				});
				// TODO: make sure that accessToken is no longer passed in query parameter
				hubUrl.value = `${hubIndexBase(hub)}?${new URLSearchParams({ accessToken: authInfo, hubId, cb: cacheBust, HUB_URL: hubMatrixApiUrl(hub.serverUrl), PARENT_URL: window.location.origin })}`;
				return true;
			}
		}
		return false;
	}

	enum Status {
		GlobalNotLoggedIn,
		MSSAccessToken,
		MSSHubNotLoggedIn,
	}

	type HubLoggedInStatus = GlobalNotLoggedIn | MSSAccessToken | MSSHubNotLoggedIn;

	interface GlobalNotLoggedIn {
		kind: Status.GlobalNotLoggedIn;
	}

	interface MSSHubNotLoggedIn {
		kind: Status.MSSHubNotLoggedIn;
	}

	interface MSSAccessToken {
		kind: Status.MSSAccessToken;
		token: string;
		userId: string;
	}

	function hubloggedinstatus(hubid: string): HubLoggedInStatus {
		if (!global.loggedIn) {
			return { kind: Status.GlobalNotLoggedIn };
		}

		const authInfo = global.getAuthInfo(hubid);
		if (authInfo) {
			return {
				kind: Status.MSSAccessToken,
				token: authInfo.token,
				userId: authInfo.userId,
			};
		}

		return { kind: Status.MSSHubNotLoggedIn };
	}
</script>
