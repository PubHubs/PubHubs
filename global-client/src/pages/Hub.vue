<template>
	<iframe v-if="hubs.currentHubExists" :src="hubUrl" class="w-full h-full" name="hub" :id="iframeHubId"></iframe>
</template>

<script setup lang="ts">
	import { onMounted, watch, ref, onUnmounted } from 'vue';
	import { useRoute } from 'vue-router';
	import { iframeHubId, useHubs, useGlobal } from '@/store/store';

	const route = useRoute();
	const hubs = useHubs();
	const global = useGlobal();

	onMounted(onRouteChange);

	onUnmounted(() => {
		hubs.changeHub({
			id: '',
			roomId: '',
		});
	});

	watch(route, onRouteChange);

	const hubUrl = ref('');

	async function onRouteChange() {
		if (!hubs.hubExists(route.params.id as string)) {
			await hubs.changeHub({ id: '', roomId: '' });
		}
		handleHubAuth(route.params.id as string);
		await hubs.changeHub(route.params);
	}

	function handleHubAuth(id: string) {
		const hub = hubs.hub(id)!;
		const hubName = hub?.hubId!;
		const state = hubloggedinstatus(hubName, new URLSearchParams(window.location.search));

		switch (state.kind) {
			case Status.GlobalNotLoggedIn:
				hubUrl.value = hub.url + '#/hub/';
				break;
			case Status.HubNotLoggedIn:
				{
					const hubServer = hubs.serverUrl(hubName);
					// @ts-ignore
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
		}
	}

	enum Status {
		GlobalNotLoggedIn,
		HubNotLoggedIn,
		LoginToken,
		AccessToken,
	}

	type HubLoggedInStatus = GlobalNotLoggedIn | HubNotLoggedIn | LoginToken | AccessToken;

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

	function hubloggedinstatus(hubid: string, urlparams: URLSearchParams): HubLoggedInStatus {
		if (!global.loggedIn) {
			return { kind: Status.GlobalNotLoggedIn };
		}

		const logintoken = urlparams.get('loginToken');
		const accesstoken = localStorage.getItem(hubid + 'accessToken');

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
