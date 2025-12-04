<template>
	<iframe v-if="hubs.currentHubExists" :src="hubUrl" class="h-full w-full" name="hub" :id="iframeHubId"></iframe>
</template>

<script setup lang="ts">
	// Packages
	import { assert } from 'chai';
	import { onMounted, onUnmounted, ref, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	import { delay } from '@global-client/logic/utils/generalUtils';

	// Logic
	import { CONFIG } from '@hub-client/logic/logging/Config';
	import { Logger } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';
	import { useMSS } from '@global-client/stores/mss';

	import { iframeHubId } from '@hub-client/stores/messagebox';

	const route = useRoute();
	const router = useRouter();
	const hubs = useHubs();
	const global = useGlobal();
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
		const maxAttempts = 4;
		for (let attempt = 0; attempt < maxAttempts && !hubId; attempt++) {
			try {
				hubId = hubs.hubId(route.params.name as string);
			} catch (error) {
				LOGGER.error(SMI.ERROR, `Could not execute function onRouteChange on attempt: ${attempt}`, { error });
			}
			if (!hubId) {
				delay(attempt);
			}
		}
		if (!hubId) {
			router.push({ name: 'home' });
			return;
		}
		if (!hubs.hubExists(hubId)) {
			await hubs.changeHub({ id: '', roomId: '' });
		}
		await handleHubAuth(hubId);
		await hubs.changeHub(route.params);
	}

	async function handleHubAuth(id: string) {
		const hub = hubs.hub(id)!;
		const hubId = hub?.hubId!;
		const state = hubloggedinstatus(hubId);

		switch (state.kind) {
			case Status.GlobalNotLoggedIn:
				hubUrl.value = hub.url + '#/hub/';
				break;
			case Status.MSSHubNotLoggedIn: {
				try {
					const maxAttempts = 4;
					for (let attempt = 0; attempt < maxAttempts; attempt++) {
						if (attempt > 0) {
							delay(attempt - 1);
						}
						const mss = useMSS();
						const enterStartResp = await hub.enterStartEP();
						assert.isDefined(enterStartResp, 'Something went wrong receiving/handling the response from enterStartEP.');
						const hhpp = await mss.enterHub(id, enterStartResp);
						assert.isDefined(hhpp, 'Something went wrong with getting the signedHhpp.');
						const enterCompleteResp = await hub.enterCompleteEP(enterStartResp.state, hhpp);
						if (enterCompleteResp === 'RetryFromStart' && attempt < maxAttempts) continue;
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
