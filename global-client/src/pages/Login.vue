<template>
	<div class="flex w-full items-center bg-surface px-6 py-4" :class="isMobile ? 'h-[7.5rem]' : 'h-[10rem]'">
		<div class="flex h-full w-full items-center justify-between gap-16">
			<a :href="globalClientUrl" rel="noopener noreferrer" class="h-full py-2">
				<Logo />
			</a>
			<div class="flex h-4 items-center justify-center gap-2">
				<p class="cursor-pointer font-bold hover:text-accent-primary" @click="changeLanguage('nl')">NL</p>
				<span>|</span>
				<p class="cursor-pointer font-bold hover:text-accent-primary" @click="changeLanguage('en')">EN</p>
			</div>
		</div>
	</div>

	<div class="w-full bg-background" :class="isMobile ? 'h-[calc(100svh_-_7.5rem)]' : 'h-[calc(100svh_-_10rem)]'">
		<div class="flex h-full w-full items-center justify-center" :class="isMobile ? 'flex-col' : 'flex-row'">
			<div class="flex items-center justify-center bg-surface-low" :class="isMobile ? 'h-1/2 w-full ~px-8/16' : 'h-full w-1/2 ~px-24/48'">
				<figure class="h-auto w-full">
					<img src="../assets/mascot-welcome.svg" alt="PubHubs mascot" />
				</figure>
			</div>
			<div class="flex flex-col items-center justify-center ~gap-4/8" :class="isMobile ? 'h-1/2 w-full' : 'h-full w-1/2'">
				<div class="flex flex-col ~gap-4/8">
					<div class="flex flex-col ~gap-2/4">
						<H1>{{ $t('home.welcome_to', [$t('common.app_name')]) }}</H1>
						<P>{{ $t('register.have_account', [$t('common.app_name')]) }}</P>
					</div>
					<div class="flex flex-col ~gap-2/4">
						<div v-show="show" class="relative flex w-full items-center justify-center" :class="isMobile ? '-mb-2' : '-mb-4'">
							<div
								id="yivi-authentication"
								class="absolute bottom-8 left-0 z-50 w-full after:absolute after:-bottom-[1.2em] after:right-[50%] after:border-[1.25em] after:border-b-0 after:border-l-0 after:border-transparent after:border-t-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
							></div>
						</div>
						<Button color="gray" @click="login()">{{ show ? $t('dialog.close') : $t('login.login') }}</Button>
						<router-link to="/register" class="w-full">
							<Button>{{ $t('register.register_with', [$t('common.yivi')]) }}</Button>
						</router-link>
					</div>
				</div>
			</div>
		</div>
	</div>

	<form v-if="show" method="POST" action="/yivi-endpoint/finish-and-redirect">
		<input type="hidden" name="yivi_token" :value="yivi_token" />
	</form>
</template>

<script setup lang="ts">
	// Package imports
	import { computed, ref } from 'vue';

	// Global imports
	import { useGlobal } from '@/logic/store/global';
	import { useSettings, FeatureFlag } from '@/logic/store/settings';
	import { useMSS } from '@/logic/store/mss';
	import { startYiviSession } from '@/logic/utils/yiviHandler';
	import { loginMethods, PHCEnterMode } from '@/model/MSS/TMultiServerSetup';
	import Logo from '@/components/ui/Logo.vue';
	import { useRoute, useRouter } from 'vue-router';

	// Hub imports
	import { Logger } from '@/logic/foundation/Logger';
	import { CONFIG } from '@/../../hub-client/src/logic/foundation/Config';
	import { SMI } from '@/../../hub-client/src/logic/foundation/StatusMessage';
	import Button from '@/../../hub-client/src/components/elements/Button.vue';
	import H1 from '@/../../hub-client/src/components/elements/H1.vue';
	import P from '@/../../hub-client/src/components/elements/P.vue';

	const global = useGlobal();
	const settings = useSettings();
	const router = useRouter();
	const route = useRoute();
	const mss = useMSS();

	const LOGGER = new Logger('GC', CONFIG);

	const globalClientUrl = _env.PUBHUBS_URL;

	const show = ref<Boolean>(false);
	const yivi_token = ref<string>('');

	const isMobile = computed(() => settings.isMobileState);

	async function login() {
		if (settings.isFeatureEnabled(FeatureFlag.multiServerSetup)) {
			await loginMSS();
		} else {
			loadYivi();
		}
	}

	async function loginMSS() {
		const loginMethod = loginMethods.Yivi; // If there will be multiple sources at a later point, this choice should be made by the user.

		if (loginMethod === loginMethods.Yivi) {
			show.value = !show.value;
		}
		try {
			const errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.Login);
			if (errorMessage) {
				router.replace({ name: 'error', query: { errorKey: errorMessage.key, errorValues: errorMessage.values } });
				show.value = false;
				return;
			}
			// await global.checkLoginAndSettings();
			show.value = false;
			const redirectPath = route.query.redirect?.toString() || '/';
			router.replace(redirectPath);
		} catch (error) {
			router.replace({ name: 'error' });
			show.value = false;
			LOGGER.error(SMI.ERROR, 'Error during MSS login', { error });
		}
	}

	function loadYivi() {
		show.value = !show.value;

		try {
			startYiviSession(false, yivi_token);
		} catch (error) {
			console.error('Yivi session load failed:', error);
		}
	}

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
