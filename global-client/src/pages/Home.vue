<template>
	<div class="m-4 mx-auto w-1/2 text-center md:w-2/6">
		<Logo class="my-8"></Logo>
		<p class="text-center" v-html="$t('home.welcome')"></p>
		<div v-if="!global.loggedIn" class="mt-8 flex flex-col items-center">
			<Button class="w-full md:px-12" @click="loadYivi">{{ $t('login.global_login') }}</Button>
			<div v-show="show" class="relative">
				<Icon type="close" class="absolute right-2 top-8 z-10 cursor-pointer dark:text-black" @click="closeYivi"></Icon>
				<div
					id="yivi-login"
					class="relative top-6 !mb-6 w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
				>
					<!-- Yivi content -->
				</div>
			</div>
		</div>
		<router-link v-if="!global.loggedIn" to="/register">
			<Button :color="'blue'" class="mt-8" @click="false">{{ $t('register.register_with') }} PubHubs</Button>
		</router-link>
	</div>

	<div class="mx-auto my-8 w-4/6">
		<Line class="mx-1 mb-8"></Line>

		<H2 class="mb-8 text-center">{{ $t('home.highlighted_hubs') }}</H2>

		<div class="grid gap-8 md:grid-cols-3">
			<button v-for="hub in hubs.activeHubs" :key="hub.hubId" @click="enterHub(hub)" class="overflow-hidden">
				<HubBlock :hub="hub"></HubBlock>
			</button>
		</div>
	</div>
	<form v-if="show" method="POST" action="/yivi-endpoint/finish-and-redirect">
		<input type="hidden" name="yivi_token" :value="yivi_token" />
	</form>
</template>

<script setup lang="ts">
	import { useGlobal, useHubs } from '@/logic/store/store';
	import { ref } from 'vue';
	import { yivi } from '@/yivi';
	import { Hub } from '@/model/Hubs';
	import { useRouter } from 'vue-router';
	import { useDialog } from '@/logic/store/store';
	import { useI18n } from 'vue-i18n';

	const { t } = useI18n();
	const global = useGlobal();
	const hubs = useHubs();
	const router = useRouter();
	const dialog = useDialog();

	const show = ref<Boolean>(false);
	const yivi_token = ref<string>('');

	function loadYivi() {
		show.value = !show.value;
		yivi(false, yivi_token);
	}

	function closeYivi() {
		show.value = false;
	}

	async function enterHub(hub: Hub) {
		let canEnterHub = false;
		try {
			// entering only the hub would generate a CORS-error.
			// Since we only need to know if the hub is running, we can send a no-cors.
			// The response will be empty, but the type 'opaque' will indicate the url is up and running
			const response = await fetch(hub.url, { mode: 'no-cors' });
			if (response.type === 'opaque') {
				canEnterHub = true;
			}
		} catch {
			// intentionally left empty
		}
		if (canEnterHub) {
			router.push({ name: 'hub', params: { name: hub.name } });
		} else {
			await dialog.confirm(hub.name, t('hubs.under_construction'));
		}
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
