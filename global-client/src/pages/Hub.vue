<template>
	<iframe v-if="hubs.currentHubExists" :src="hubUrl" class="h-full w-full" name="hub" :id="iframeHubId"></iframe>
</template>

<script setup lang="ts">
	// Package imports
	import { onMounted, watch, ref, onUnmounted } from 'vue';
	import { useRoute, useRouter } from 'vue-router';
	import { assert } from 'chai';

	// Global imports
	import { useGlobal } from '@/logic/store/global';
	import { useHubs } from '@/logic/store/hubs';
	import { iframeHubId } from '@/logic/store/messagebox';
	import { useMSS } from '@/logic/store/mss';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	// Hub imports
	import { Logger } from '@/../../hub-client/src/logic/foundation/Logger';
	import { CONFIG } from '@/../../hub-client/src/logic/foundation/Config';
	import { SMI } from '@/../../hub-client/src/logic/foundation/StatusMessage';

	const route = useRoute();
	const router = useRouter();
	const hubs = useHubs();
	const global = useGlobal();
	const settings = useSettings();
	const LOGGER = new Logger('GC', CONFIG);

	onMounted(onRouteChange);

	onUnmounted(() => {
		hubs.changeHub({
			name: '',
			roomId: '',
		});
	});

	watch(route, onRouteChange);

	const hubUrl = ref('');

	async function onRouteChange() {
		let hubId = undefined;
		const maxAttempts = 10;
		// TODO try to change timings of vue events so there is less wait time in this function
		for (let attempts = 0; attempts < maxAttempts && !hubId; attempts++) {
			try {
				await new Promise((r) => setTimeout(r, 100));
				hubId = hubs.hubId(route.params.name as string);
				if (!hubs.hubExists(hubId)) {
					await hubs.changeHub({ id: '', roomId: '' });
				}
				await handleHubAuth(hubId);
				await hubs.changeHub(route.params);
				continue;
			} catch (error) {
				LOGGER.error(SMI.ERROR, `Could not execute function onRouteChange on attempt: ${attempts}`, { error });
			}
		}
		if (!hubId) router.push({ name: 'home' });
	}

	async function handleHubAuth(id: string) {
		const hub = hubs.hub(id)!;
		const hubId = hub?.hubId!;
		const state = hubloggedinstatus(hubId, new URLSearchParams(window.location.search));

		switch (state.kind) {
			case Status.GlobalNotLoggedIn:
				hubUrl.value = hub.url + '#/hub/';
				break;
			case Status.HubNotLoggedIn:
				{
					const hubServer = hubs.serverUrl(hubId);
					const redirect = _env.PUBHUBS_URL + '/client%23' + window.location.hash.substring(1);
					window.location.assign(hubServer + '_matrix/client/v3/login/sso/redirect?redirectUrl=' + redirect);
				}
				break;
			case Status.LoginToken:
				hubUrl.value = hub.url + '?loginToken=' + state.token;
				window.history.replaceState('', '', '/client/#' + window.location.hash.substring(1));
				break;
			case Status.AccessToken:
				hubUrl.value = hub.url + '?accessToken=' + state.token;
				break;
			case Status.MSSHubNotLoggedIn: {
				try {
					const maxAttempts = 3;
					for (let attempts = 0; attempts < maxAttempts; attempts++) {
						const mss = useMSS();
						const enterStartResp = await hub.enterStartEP();
						assert.isDefined(enterStartResp, 'Something went wrong receiving/handling the response from enterStartEP.');
						const hhpp = await mss.enterHub(id, enterStartResp);
						assert.isDefined(hhpp, 'Something went wrong with getting the signedHhpp.');
						const enterCompleteResp = await hub.enterCompleteEP(enterStartResp.state, hhpp);
						// TODO Floris: Add a little delay for each retry
						if (enterCompleteResp === 'RetryFromStart' && attempts < maxAttempts) continue;
						else if (enterCompleteResp === 'RetryFromStart') throw new Error('Max attemps for RetryFromStart were passed');
						assert.isDefined(enterCompleteResp, 'Something went wrong receiving/handling a response from enterCompleteEP.');
						const authInfo = JSON.stringify({
							token: enterCompleteResp.access_token,
							userId: enterCompleteResp.mxid,
						});
						// TODO make sure that accessToken is no longer passed in query parameter
						hubUrl.value = hub.url + '?newToken=true&accessToken=' + authInfo;
						break;
					}
				} catch (error) {
					LOGGER.error(SMI.ERROR, 'Error during Hub MSS login', { error });
					router.push({ name: 'error' });
				}
				break;
			}
			case Status.MSSAccessToken:
				const authInfo = JSON.stringify({
					token: state.token,
					userId: state.userId,
				});
				// TODO: make sure that accessToken is no longer passed in query parameter
				hubUrl.value = hub.url + '?accessToken=' + authInfo;
				break;
		}
	}

	enum Status {
		GlobalNotLoggedIn,
		HubNotLoggedIn,
		LoginToken,
		AccessToken,
		MSSAccessToken,
		MSSHubNotLoggedIn,
	}

	type HubLoggedInStatus = GlobalNotLoggedIn | HubNotLoggedIn | LoginToken | AccessToken | MSSAccessToken | MSSHubNotLoggedIn;

	interface GlobalNotLoggedIn {
		kind: Status.GlobalNotLoggedIn;
	}

	interface HubNotLoggedIn {
		kind: Status.HubNotLoggedIn;
	}

	interface LoginToken {
		kind: Status.LoginToken;
		token: string;
	}

	interface AccessToken {
		kind: Status.AccessToken;
		token: string;
	}

	interface MSSHubNotLoggedIn {
		kind: Status.MSSHubNotLoggedIn;
	}

	interface MSSAccessToken {
		kind: Status.MSSAccessToken;
		token: string;
		userId: string;
	}

	function hubloggedinstatus(hubid: string, urlparams: URLSearchParams): HubLoggedInStatus {
		if (!global.loggedIn) {
			return { kind: Status.GlobalNotLoggedIn };
		}

		if (settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
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

		const accesstoken = global.getAccessToken(hubid);

		const logintoken = urlparams.get('loginToken');

		if (logintoken && !accesstoken) {
			return {
				kind: Status.LoginToken,
				token: logintoken,
			};
		}

		if (accesstoken) {
			return {
				kind: Status.AccessToken,
				token: accesstoken,
			};
		}

		return { kind: Status.HubNotLoggedIn };
	}
</script>
