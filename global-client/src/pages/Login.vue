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
							:alt="$t('login.mascot_alt', [$t('common.app_name')])"
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
							<div class="flex gap-200">
								<!-- Anchor for the Yivi popup, so it is positioned relative to the login button instead of the whole button row -->
								<div class="relative">
									<!-- Yivi sizes itself to its content, which differs per state (QR, loading, error), so the box is pinned to a fixed size -->
									<div
										v-show="show"
										class="absolute bottom-full left-0 mb-150 h-4000 w-3500"
									>
										<!-- Loading overlay - uses yivi-web-form class to match Yivi's styling -->
										<div
											v-if="qrLoading"
											class="yivi-web-form absolute inset-0 z-[40] flex items-center justify-center"
										>
											<div class="flex flex-col items-center gap-2">
												<InlineSpinner />
												<P class="text-on-surface-dim text-sm">{{ $t('login.loading_yivi') }}</P>
											</div>
										</div>
										<!-- Yivi injects content here - must be empty -->
										<div
											ref="yiviMountPoint"
											class="yivi-mount absolute inset-0 z-50"
										/>
									</div>
									<!-- Popup tail, centered on the login button -->
									<div
										v-show="show"
										class="absolute bottom-full left-1/2 z-50 h-0 w-0 -translate-x-1/2 border-x-[12px] border-t-[12px] border-b-0 border-x-transparent border-t-white drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
									/>
									<Button
										variant="secondary"
										@click="loginMSS()"
									>
										{{ show ? $t('dialog.close') : $t('login.login') }}
									</Button>
								</div>
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
							<P class="whitespace-pre-line">{{ $t(error.key, error.values ?? []) }}</P>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, onUnmounted, ref } from 'vue';
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
	import { EnterCancelled, useMSS } from '@global-client/stores/mss';

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
	const error = ref<{ key: string; values?: string[] } | undefined>();

	// The element the Yivi widget renders into, inside the popup above the login button.
	const yiviMountPoint = ref<HTMLElement | null>(null);

	const isMobile = computed(() => settings.isMobileState);

	// Check for message passed via query params (e.g., from logout)
	const message = computed(() => {
		const key = route.query.message?.toString();
		if (!key) return null;
		const values = route.query.messageValues?.toString().split(',').filter(Boolean) || [];
		return { key, values };
	});

	// Watches the Yivi element for the QR code to appear, so the loading overlay can step aside. Kept
	// here so closing the popup, or leaving the page, takes it off the element again.
	let qrObserver: MutationObserver | null = null;

	// Generation counter for `loginMSS`. The store cancels a run it replaces, but only reports that as
	// `EnterCancelled` up to the disclosure; an attempt that gets that far and is then superseded runs
	// to completion and resolves normally. Its result belongs to a popup that is no longer on screen,
	// so this guards what the page shows and where it navigates.
	let currentRun = 0;

	const closePopupOnPageShow = (event: PageTransitionEvent): void => {
		// Only a restore from the back/forward cache brings back a popup with a session behind it that
		// has gone stale in the meantime.
		if (!event.persisted) return;
		closeYiviPopup();
	};

	onMounted(async () => {
		window.addEventListener('pageshow', closePopupOnPageShow);

		try {
			loading.value = true;
			await mss.initializeServers();
			loading.value = false;
		} catch (error) {
			router.replace({ name: 'error' });
			logger.error('Could not initialize the servers for the multi-server setup.', { error });
		}
	});

	onUnmounted(() => {
		window.removeEventListener('pageshow', closePopupOnPageShow);
		closeYiviPopup();
	});

	// Hide the popup and end the session behind it: a Yivi session left running keeps polling and
	// holds on to the element the next one renders into.
	function closeYiviPopup() {
		show.value = false;
		qrLoading.value = false;
		qrObserver?.disconnect();
		qrObserver = null;
		// Bumping the counter keeps an attempt that is still unwinding from writing to a popup that has
		// been put away, or from navigating on a login the user has just closed.
		currentRun++;
		mss.cancelEnter();
	}

	async function loginMSS() {
		const loginMethod = loginMethods.Yivi; // If there will be multiple sources at a later point, this choice should be made by the user.

		// The button doubles as the popup's close button.
		if (show.value) {
			closeYiviPopup();
			return;
		}

		// `AuthenticationServer` holds a single auth state, so a new attempt invalidates whatever the
		// previous one was still waiting on: only the newest attempt may show an error or navigate.
		const runId = ++currentRun;
		const superseded = () => runId !== currentRun;

		// The message this attempt replaces stays on screen once the popup is closed, so a new attempt
		// has to take it away itself - the QR code is otherwise shown underneath the reason the
		// previous one failed.
		error.value = undefined;

		show.value = true;
		qrLoading.value = true;
		watchForYiviContent();

		try {
			const errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.Login, yiviMountPoint);
			if (superseded()) return;
			if (errorMessage) {
				error.value = errorMessage;
				closeYiviPopup();
				return;
			}
			closeYiviPopup();
			const redirectPath = route.query.redirect?.toString() || '/';
			router.replace(redirectPath);
		} catch (err) {
			// A second click, or the close button, supersedes this attempt; whoever did that has
			// already put the popup away.
			if (superseded() || err instanceof EnterCancelled) return;
			router.replace({ name: 'error' });
			closeYiviPopup();
			logger.error('Error during MSS login', { err });
		}
	}

	function watchForYiviContent() {
		const yiviEl = yiviMountPoint.value;
		if (!yiviEl) return;

		qrObserver?.disconnect();
		const observer = new MutationObserver(() => {
			// Wait for actual QR code (canvas or svg) not just the text
			const hasQrCode = yiviEl.querySelector('canvas, svg');
			if (hasQrCode) {
				qrLoading.value = false;
				observer.disconnect();
				if (qrObserver === observer) qrObserver = null;
			}
		});

		qrObserver = observer;
		observer.observe(yiviEl, { childList: true, subtree: true });
	}
</script>

<style scoped>
	/* Yivi injects its own markup, so these need :deep() to reach it. */

	/* Let the content area absorb the remaining height of the pinned box, so the QR code, the
	   loading animation and any error or message stay centered in the same spot in every state. */
	.yivi-mount :deep(.yivi-web-content) {
		flex: 1 1 auto;
	}

	/* The QR is an inline <svg>, so its line box reserves ~7px of descender space below the
	   QR code, which made the QR state taller than Yivi's other states */
	.yivi-mount :deep(.yivi-web-qr-code > svg) {
		display: block;
	}
</style>
