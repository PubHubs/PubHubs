<template>
	<div v-if="loading" class="flex h-full flex-col items-center justify-center">
		<P class="p-4">{{ $t('common.loading') }}</P>
		<InlineSpinner size="lg" />
	</div>

	<div v-else>
		<div class="bg-surface flex w-full items-center px-6 py-4" :class="isMobile ? 'h-[7.5rem]' : 'h-[10rem]'">
			<div class="flex h-full w-full items-center justify-between gap-16">
				<a :href="globalClientUrl" rel="noopener noreferrer" class="h-full py-2">
					<Logo />
				</a>
				<div class="flex h-4 items-center justify-center gap-2">
					<p class="hover:text-accent-primary cursor-pointer font-bold" @click="changeLanguage('nl')">NL</p>
					<span>|</span>
					<p class="hover:text-accent-primary cursor-pointer font-bold" @click="changeLanguage('en')">EN</p>
				</div>
			</div>
		</div>

		<div class="bg-background w-full" :class="isMobile ? 'h-[calc(100svh-7.5rem)]' : 'h-[calc(100svh-10rem)]'">
			<div class="flex h-full w-full items-center justify-center" :class="isMobile ? 'flex-col' : 'flex-row'">
				<div class="bg-surface-low flex items-center justify-center" :class="isMobile ? 'h-1/2 w-full px-12' : 'h-full w-1/2 px-36'">
					<figure class="h-auto w-full">
						<img src="../assets/mascot-welcome.svg" alt="PubHubs mascot" />
					</figure>
				</div>
				<div class="flex flex-col items-center justify-center gap-6" :class="isMobile ? 'h-1/2 w-full' : 'h-full w-1/2'">
					<div class="flex flex-col gap-6">
						<div class="flex flex-col gap-4">
							<H1>
								{{ $t('common.app_name') }}
								{{ $t('login.global_login') }}
							</H1>
							<P>{{ $t('register.have_account', [$t('common.app_name')]) }}</P>
						</div>
						<div class="flex flex-col gap-4">
							<div v-show="show" class="relative flex w-full items-center justify-center" :class="isMobile ? '-mb-2' : '-mb-4'">
								<div
									id="yivi-authentication"
									class="absolute bottom-8 left-0 z-50 w-full after:absolute after:right-[50%] after:-bottom-[1.2em] after:border-[1.25em] after:border-b-0 after:border-l-0 after:border-transparent after:border-t-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
								></div>
							</div>
							<Button color="gray" @click="loginMSS()">{{ show ? $t('dialog.close') : $t('login.login') }}</Button>
							<router-link :to="{ path: '/register', query: { redirectPath: redirectPath } }" class="w-full">
								<Button>{{ $t('register.register_with', [$t('common.yivi')]) }}</Button>
							</router-link>
						</div>
					</div>

					<div v-if="error" class="items-top bg-surface-low text-accent-error m-8 flex w-3/4 flex-row gap-x-4 rounded-xl px-4 py-8 break-normal">
						<Icon type="warning" class="mt-1"></Icon>
						<P> {{ $t(error.key, error.values) }}</P>
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
	import Icon from '@hub-client/components/elements/Icon.vue';
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
	const error = ref();

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
				error.value = errorMessage;
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
