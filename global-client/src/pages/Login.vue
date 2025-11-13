<template>
	<div v-if="loading" class="flex h-full flex-col items-center justify-center">
		<P class="p-4">{{ $t('common.loading') }}</P>
		<InlineSpinner size="lg" />
	</div>

	<div v-else>
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
							<Button color="gray" @click="loginMSS()">{{ show ? $t('dialog.close') : $t('login.login') }}</Button>
							<router-link :to="{ path: '/register', query: { redirectPath: redirectPath } }" class="w-full">
								<Button>{{ $t('register.register_with', [$t('common.yivi')]) }}</Button>
							</router-link>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	import Logo from '@global-client/components/ui/Logo.vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import P from '@hub-client/components/elements/P.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import { CONFIG } from '@hub-client/logic/logging/Config';
	import { Logger } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { loginMethods } from '@global-client/models/MSS/TAuths';
	import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

	// Stores
	import { useMSS } from '@global-client/stores/mss';

	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const router = useRouter();
	const route = useRoute();

	const redirectPath = computed(() => {
		const fullPath = decodeURI(router.currentRoute.value.fullPath);
		const redirect = '/login?redirect=/';
		if (fullPath.startsWith(redirect)) {
			return '/' + fullPath.slice(redirect.length);
		}
		return null;
	});
	const mss = useMSS();

	const LOGGER = new Logger('GC', CONFIG);

	const globalClientUrl = _env.PUBHUBS_URL;

	const show = ref<boolean>(false);
	const loading = ref<boolean>(true);

	const isMobile = computed(() => settings.isMobileState);

	onMounted(async () => {
		try {
			loading.value = true;
			await mss.initializeServers();
			loading.value = false;
		} catch (error) {
			router.replace({ name: 'error' });
			LOGGER.error(SMI.ERROR, 'Could not initialize the servers for the multi-server setup.', { error });
		}
	});

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
			show.value = false;
			const redirectPath = route.query.redirect?.toString() || '/';
			router.replace(redirectPath);
		} catch (error) {
			router.replace({ name: 'error' });
			show.value = false;
			LOGGER.error(SMI.ERROR, 'Error during MSS login', { error });
		}
	}

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
