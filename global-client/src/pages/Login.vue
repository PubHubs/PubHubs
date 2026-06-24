<template>
	<div
		v-if="loading"
		class="flex h-full flex-col items-center justify-center"
	>
		<P class="p-200">
			{{ $t('common.loading') }}
		</P>
		<InlineSpinner size="lg" />
	</div>

	<div
		v-else
		class="flex w-full flex-col"
	>
		<AuthHeader />

		<div class="bg-background h-[calc(100svh-80px)] w-full">
			<div
				class="flex h-full w-full items-center justify-center"
				:class="isMobile ? 'flex-col' : 'flex-row'"
			>
				<div
					class="bg-surface-sunken/50 flex shrink-0 items-center justify-center"
					:class="isMobile ? 'h-2/5 w-full px-600' : 'h-full w-1/2 px-2000'"
				>
					<figure class="h-auto w-full">
						<img
							alt="PubHubs mascot"
							src="../assets/mascot-welcome.svg"
						/>
					</figure>
				</div>
				<div
					class="flex flex-col items-center justify-center gap-300"
					:class="isMobile ? 'h-3/5 w-full p-200' : 'h-full w-1/2'"
				>
					<div
						class="flex flex-col gap-300"
						:class="!isMobile && 'max-w-1/2'"
					>
						<div class="flex flex-col gap-200">
							<H1>
								{{ $t('common.app_name') }}
								{{ $t('login.login') }}
							</H1>
							<P>{{ $t('register.have_account', [$t('common.app_name')]) }}</P>
						</div>
						<div class="flex flex-col gap-200">
							<div
								v-show="show"
								class="relative flex w-full items-center justify-center"
								:class="isMobile ? '-mb-100' : '-mb-200'"
							>
								<!-- Loading overlay - uses yivi-web-form class to match Yivi's dimensions -->
								<div
									v-if="qrLoading"
									class="yivi-web-form absolute bottom-400 left-1/2 z-[40] flex aspect-square min-w-[250px] -translate-x-1/2 items-center justify-center after:absolute after:right-[50%] after:-bottom-[1.2em] after:border-[1.25em] after:border-b-0 after:border-l-0 after:border-transparent after:border-t-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
								>
									<div class="flex flex-col items-center gap-2">
										<InlineSpinner />
										<P class="text-on-surface-dim text-sm">{{ $t('login.loading_yivi') }}</P>
									</div>
								</div>
								<!-- Yivi injects content here - must be empty -->
								<div
									id="yivi-authentication"
									class="absolute bottom-400 left-1/2 z-50 -translate-x-1/2 after:absolute after:right-[50%] after:-bottom-[1.2em] after:border-[1.25em] after:border-b-0 after:border-l-0 after:border-transparent after:border-t-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
								/>
							</div>
							<div class="flex gap-200">
								<Button
									variant="secondary"
									@click="loginMSS()"
								>
									{{ show ? $t('dialog.close') : $t('login.login') }}
								</Button>
								<router-link
									class="w-full"
									:to="{ path: '/register', query: { redirectPath: redirectPath } }"
								>
									<Button>{{ $t('register.register_with', [$t('common.yivi')]) }}</Button>
								</router-link>
							</div>
						</div>

						<!-- Info message (e.g., from logout) -->
						<div
							v-if="message"
							class="items-top bg-surface text-accent-primary border-surface-elevated mt-200 flex w-3/4 w-full flex-row items-center gap-x-200 rounded border-3 px-200 py-400 break-normal"
						>
							<Icon type="info" />
							<P>{{ $t(message.key, message.values) }}</P>
						</div>

						<!-- Error message -->
						<div
							v-if="error"
							class="items-top bg-surface text-accent-error border-surface-elevated mt-200 flex w-3/4 w-fit w-full flex-row gap-x-200 rounded border-3 px-200 py-400 break-normal"
						>
							<Icon type="warning" />
							<P>{{ $t(error.key, error.values) }}</P>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	import AuthHeader from '@global-client/components/ui/onboarding/AuthHeader.vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

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

	const logger = createLogger('Login');

	const show = ref<boolean>(false);
	const loading = ref<boolean>(true);
	const qrLoading = ref<boolean>(false);
	const error = ref();

	const isMobile = computed(() => settings.isMobileState);

	// Check for message passed via query params (e.g., from logout)
	const message = computed(() => {
		const key = route.query.message?.toString();
		if (!key) return null;
		const values = route.query.messageValues?.toString().split(',').filter(Boolean) || [];
		return { key, values };
	});

	onMounted(async () => {
		try {
			loading.value = true;
			await mss.initializeServers();
			loading.value = false;
		} catch (error) {
			router.replace({ name: 'error' });
			logger.error('Could not initialize the servers for the multi-server setup.', { error });
		}
	});

	async function loginMSS() {
		const loginMethod = loginMethods.Yivi; // If there will be multiple sources at a later point, this choice should be made by the user.

		if (loginMethod === loginMethods.Yivi) {
			show.value = !show.value;
			if (show.value) {
				qrLoading.value = true;
				watchForYiviContent();
			}
		}
		try {
			const errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.Login);
			if (errorMessage) {
				error.value = errorMessage;
				show.value = false;
				qrLoading.value = false;
				return;
			}
			show.value = false;
			qrLoading.value = false;
			const redirectPath = route.query.redirect?.toString() || '/';
			router.replace(redirectPath);
		} catch (error) {
			router.replace({ name: 'error' });
			show.value = false;
			qrLoading.value = false;
			logger.error('Error during MSS login', { error });
		}
	}

	function watchForYiviContent() {
		const yiviEl = document.getElementById('yivi-authentication');
		if (!yiviEl) return;

		const observer = new MutationObserver(() => {
			// Wait for actual QR code (canvas or svg) not just the text
			const hasQrCode = yiviEl.querySelector('canvas, svg');
			if (hasQrCode) {
				qrLoading.value = false;
				observer.disconnect();
			}
		});

		observer.observe(yiviEl, { childList: true, subtree: true });
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
