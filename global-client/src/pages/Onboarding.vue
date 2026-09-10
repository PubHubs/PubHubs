<template>
	<div class="flex w-full max-w-screen flex-col">
		<AuthHeader />

		<div class="h-[calc(100svh-80px)] overflow-y-auto">
			<!-- Registration section -->
			<section
				class="bg-background flex flex-col overflow-x-hidden"
				:class="isMobile ? 'h-[calc(100svh-7.5rem)] gap-200 py-200' : 'gap-400 py-800'"
			>
				<div
					class="flex shrink-0 flex-col"
					:class="isMobile ? 'h-full gap-200' : 'gap-400'"
				>
					<!-- Title -->
					<div class="mx-auto w-full max-w-[80ch]">
						<div
							class="flex flex-col gap-100"
							:class="isMobile && 'px-200'"
						>
							<P
								v-if="!isMobile"
								class="font-semibold"
							>
								{{ $t('register.no_account_yet', [$t('common.app_name')]) }}
							</P>
							<H1>{{ $t('register.register_3_steps', [$t('common.app_name')]) }}</H1>
						</div>
					</div>

					<!-- Carousel -->
					<div
						class="flex h-full w-full max-w-screen flex-col gap-200 overflow-hidden"
						:class="isMobile && 'max-h-[calc(100svh-80px)]'"
					>
						<!-- Mobile -->
						<div
							v-if="isMobile"
							ref="carouselMobile"
							class="no-scrollbar flex h-full snap-x snap-mandatory gap-200 overflow-x-auto scroll-smooth px-200"
							@scroll="updateCurrentIndexFromScroll"
						>
							<!-- Card 1 -->
							<CarouselCardMobile
								:index="0"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_1_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex h-full flex-col gap-100">
									<P>{{ $t('register.card_1_text_1', [$t('common.app_name'), $t('common.yivi')]) }}</P>
									<div class="flex h-full w-full items-center justify-center">
										<div class="w-full" />
										<DownloadLinks class="my-100 pr-400" />
										<div class="w-full" />
									</div>
								</div>
							</CarouselCardMobile>

							<!-- Card 2 -->
							<CarouselCardMobile
								:index="1"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_2_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex flex-col gap-100">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #image>
									<figure class="flex h-full w-full items-center justify-center">
										<img
											:alt="$t('register.card_2_alt', [$t('common.app_name')])"
											class="object-cover"
											src="../assets/mascot-attributes.svg"
										/>
									</figure>
								</template>
							</CarouselCardMobile>

							<!-- Card 3 -->
							<CarouselCardMobile
								:index="2"
								:class="[
									error && 'outline-accent-error card-shake text-on-accent-error outline outline-6',
									showSuccess && 'outline-accent-success outline outline-6',
								]"
								:error="!!error"
								:success="showSuccess"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ cardTitle }}</H2>
								</template>

								<div class="flex flex-col gap-100">
									<P>{{ error ? errorText : cardText }}</P>
									<Button
										v-if="retry"
										class="self-start"
										@click="retryFailedStep"
									>
										{{ $t('common.retry') }}
									</Button>
								</div>

								<template #extra>
									<div class="flex h-full w-full flex-col items-center justify-center gap-200">
										<div
											ref="yiviMobile"
											class="aspect-square w-full"
										/>
									</div>
								</template>
							</CarouselCardMobile>
						</div>

						<!-- Desktop -->
						<div
							v-else
							ref="carouselDesktop"
							class="no-scrollbar flex snap-x snap-mandatory gap-600 overflow-x-auto scroll-smooth py-300"
							style="
								padding-left: max(1rem, calc(50vw - 40ch));
								padding-right: max(1rem, calc(50vw - 40ch));
								scroll-padding-left: max(1rem, calc(50vw - 40ch));
								scroll-padding-right: max(1rem, calc(50vw - 40ch));
							"
							@scroll="updateCurrentIndexFromScroll"
						>
							<!-- Card 1 -->
							<CarouselCard
								:active="currentIndex === 0"
								:class="currentIndex !== 0 && 'pointer-events-none'"
								:index="0"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_1_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex flex-col gap-100">
									<P>{{ $t('register.card_1_text_1', [$t('common.app_name'), $t('common.yivi')]) }}</P>
									<DownloadLinks class="my-100" />
									<H2>{{ $t('register.card_1_yivi', [$t('common.yivi')]) }}</H2>
									<P>{{ $t('register.card_1_yivi_text', [$t('common.yivi')]) }}</P>
								</div>

								<template #right>
									<figure class="flex h-full w-full items-center justify-center">
										<img
											:alt="$t('register.card_1_alt')"
											class="object-cover"
											src="../assets/laptop.svg"
										/>
									</figure>
								</template>
							</CarouselCard>

							<!-- Card 2 -->
							<CarouselCard
								:active="currentIndex === 1"
								:class="currentIndex !== 1 && 'pointer-events-none'"
								:index="1"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_2_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex flex-col gap-100">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #right>
									<figure class="flex h-full w-full items-center justify-center px-400 xl:px-1000">
										<img
											:alt="$t('register.card_2_alt', [$t('common.app_name')])"
											class="object-cover"
											src="../assets/mascot-attributes.svg"
										/>
									</figure>
								</template>
							</CarouselCard>

							<!-- Card 3 -->
							<CarouselCard
								:active="currentIndex === 2"
								:class="[
									currentIndex !== 2 && 'pointer-events-none',
									error && 'outline-accent-error card-shake text-on-accent-error outline outline-6',
									showSuccess && 'outline-accent-success outline outline-6',
								]"
								:index="2"
								:error="!!error"
								:success="showSuccess"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ cardTitle }}</H2>
								</template>

								<div class="flex flex-col gap-100">
									<P :class="!retry && 'mb-300'">{{ error ? errorText : cardText }}</P>
									<!-- Registration starts on mount, so a failure can surface while the user is still reading
									card 1 or 2, with this card off-centre and inert. The button opts back in, so the retry it
									offers can be taken as soon as it is on screen. -->
									<Button
										v-if="retry"
										class="pointer-events-auto mb-300 self-start"
										@click="retryFailedStep"
									>
										{{ $t('common.retry') }}
									</Button>
								</div>

								<template #right>
									<div class="flex h-full w-full flex-col items-center justify-center gap-200">
										<div
											ref="yiviDesktop"
											class="h-fit w-fit"
										/>
									</div>
								</template>
							</CarouselCard>
						</div>

						<!-- Page Indicators -->
						<div
							class="flex items-center justify-center gap-200"
							:class="isMobile ? 'py-0' : 'py-050'"
						>
							<div
								v-for="(item, index) in items"
								:key="index"
								class="h-150 w-150 rounded-full transition-all duration-300"
								:class="[currentIndex === index ? 'bg-accent-primary scale-110' : 'bg-surface-base', 'cursor-pointer']"
								@click="scrollTo(index)"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- Yivi section -->
			<section
				class="my-800 flex w-full flex-col items-center"
				:class="isMobile ? 'mb-800' : 'mb-2000'"
			>
				<div class="flex w-full max-w-[80ch] flex-col gap-400">
					<div
						class="flex w-full"
						:class="isMobile && 'px-200'"
					>
						<H2>{{ $t('register.yivi_explained', [$t('common.yivi')]) }}</H2>
					</div>
					<VimeoFacade
						video-id="807947893"
						:rounded="!isMobile"
						title="Vimeo video player"
					/>
					<FaqSection />
				</div>
			</section>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	import VimeoFacade from '@global-client/components/ui/VimeoFacade.vue';
	// Components
	import AuthHeader from '@global-client/components/ui/onboarding/AuthHeader.vue';
	import CarouselCard from '@global-client/components/ui/onboarding/CarouselCard.vue';
	import CarouselCardMobile from '@global-client/components/ui/onboarding/CarouselCardMobile.vue';
	import DownloadLinks from '@global-client/components/ui/onboarding/DownloadLinks.vue';
	import FaqSection from '@global-client/components/ui/onboarding/FaqSection.vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import H1 from '@hub-client/components/elements/H1.vue';
	import H2 from '@hub-client/components/elements/H2.vue';
	import P from '@hub-client/components/elements/P.vue';

	// Logic
	import { canOpenYiviApp } from '@global-client/logic/utils/yiviHandler';

	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { loginMethods } from '@global-client/models/MSS/TAuths';
	import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

	// Logic
	import { EnterCancelled, useMSS } from '@global-client/stores/mss';

	// Stores
	import { DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const mss = useMSS();
	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const error = ref<{ key: string; values?: string[] } | undefined>();
	const dialog = useDialog();

	// Logging
	const logger = createLogger('Onboarding');

	// Whether this device opens the Yivi app by link instead of showing a QR code to scan with a
	// second device. Fixed for the lifetime of the page, unlike `isMobile`, which is a viewport
	// check and would flip when the window is resized.
	const yiviAppAvailable = canOpenYiviApp();

	// Reactive state
	const isMobile = computed(() => settings.isMobileState);

	// The disclosure succeeded and the PubHubs card is being issued. On a device that opens the
	// Yivi app that means a second trip into the app.
	const showSuccess = computed(() => !error.value && mss.issuingCard);

	const cardTitle = computed(() => {
		if (error.value) return t('errors.oops');
		if (showSuccess.value) return t('register.card_3_success_title');
		return yiviAppAvailable ? t('register.card_3_title_app', [t('common.yivi')]) : t('register.card_3_title');
	});

	const cardText = computed(() => {
		const names = [t('common.yivi'), t('common.app_name')];
		if (showSuccess.value) return t(yiviAppAvailable ? 'register.card_3_success_text_app' : 'register.card_3_success_text', names);
		return t(yiviAppAvailable ? 'register.card_3_text_2_app' : 'register.card_3_text_2', names);
	});

	// Error keys arrive fully qualified (`errors.<key>`), the same way `Login.vue` renders them.
	const errorText = computed(() => (error.value ? t(error.value.key, error.value.values ?? []) : ''));

	// The step card 3 offers to try again, or undefined when there is nothing to retry. A card
	// issuance is retried on its own: the account is already entered, and a fresh registration would
	// have to disclose the very PubHubs card that never reached the user's Yivi app.
	const retry = ref<{ kind: 'registration'; registerOnlyWithUniqueAttrs: boolean } | { kind: 'card'; comment: string } | undefined>();

	// The terms the registration in flight was started on, so a restart keeps them. Without this an
	// answer the user gave to the duplicate attribute dialog is lost the moment the widget has to be
	// re-rendered, and the dialog comes back.
	const registerOnlyWithUniqueAttrsInFlight = ref(true);

	// The comment of a card issuance this page is running itself, or null when there is none. The
	// issuance `enterPubHubs` runs as its last step is not this one, see `restartYiviSessionIfWaiting`.
	const cardIssuanceInFlight = ref<string | null>(null);

	const currentIndex = ref(0);
	const items = [1, 2, 3];

	// Generation counter for `startYiviSessionMSS`, see the comment there. The store keeps a counter
	// of its own for the enter attempt; this one guards what this page shows and where it navigates,
	// including the card issuance retry below, which the store does not run.
	let currentRun = 0;

	// DOM refs for carousels
	const carouselMobile = ref<HTMLDivElement | null>(null);
	const carouselDesktop = ref<HTMLDivElement | null>(null);

	const yiviMobile = ref<HTMLElement | null>(null);
	const yiviDesktop = ref<HTMLElement | null>(null);
	const yiviMountPoint = computed(() => (isMobile.value ? yiviMobile.value : yiviDesktop.value));

	// Query parameters
	const redirectPath = route.query.redirectPath as string;

	// Get the correct carousel container depending on screen size.
	const getCarouselRef = (): HTMLDivElement | null => (isMobile.value ? carouselMobile.value : carouselDesktop.value);

	// Scrolls to the given index in the carousel.
	const scrollTo = (index: number): void => {
		const el = getCarouselRef();
		if (el && el.children[index]) {
			(el.children[index] as HTMLElement).scrollIntoView({
				behavior: 'smooth',
				inline: 'center',
				block: 'nearest',
			});
			currentIndex.value = index;
		}
	};

	// Tracks which carousel item is centered. Bound in the template on both carousels, so the listener
	// follows whichever one the breakpoint put on screen instead of stacking up on the other.
	const updateCurrentIndexFromScroll = (event: Event): void => {
		const el = event.currentTarget as HTMLDivElement;
		const containerCenter = el.scrollLeft + el.offsetWidth / 2;
		const children = Array.from(el.children) as HTMLElement[];

		let closestIndex = 0;
		let minDistance = Infinity;

		children.forEach((child, index) => {
			const childCenter = child.offsetLeft + child.offsetWidth / 2;
			const distance = Math.abs(childCenter - containerCenter);
			if (distance < minDistance) {
				minDistance = distance;
				closestIndex = index;
			}
		});

		currentIndex.value = closestIndex;
	};

	// Only a widget that is on screen needs a new session, and it needs one whenever the element it
	// was rendered into is replaced - a breakpoint swap, a page restored from the back/forward cache.
	// The steps in between show nothing and survive on their own, so restarting there would only throw
	// away a registration in progress.
	//
	// Registration shows two widgets, not one: chained sessions are off, so the PubHubs card is issued
	// in a second Yivi session after the disclosure. Which of the two is up decides what to restart.
	//
	// `mountPointReplaced` says whether the element the widget rendered into is actually gone. When it
	// is, a session that is still up has nowhere left to draw and has to be restarted whatever that
	// costs. A language change leaves the element where it is and only wants the widget rebuilt in the
	// new language - not worth restarting an issuance for, because the restart races with the user
	// approving the card in their Yivi app, and losing that race issues the card twice.
	const restartYiviSessionIfWaiting = (mountPointReplaced: boolean = true): void => {
		if (cardIssuanceInFlight.value !== null) {
			// An issuance this page started: run it again against the mount point that is now on screen.
			// Only while its widget is up. Once the Yivi session is over the issuance is writing
			// to the user secret and renders nothing, and starting over there issues a second card and
			// races a second write against the one still in flight.
			if (!mountPointReplaced || !mss.issuingCard) return;
			issuePubHubsCard(cardIssuanceInFlight.value);
		} else if (mss.issuingCard) {
			// The last step of the enter run is showing the widget, and only that run knows what the card
			// is being issued for. Stopping its session makes it report `card_not_added`, which is
			// picked up below and retried with the comment it carries.
			if (!mountPointReplaced) return;
			mss.cancelEnter();
		} else if (mss.awaitingDisclosure) {
			// A disclosure costs the user nothing but a rescan, so this one does follow the language.
			startYiviSessionMSS(registerOnlyWithUniqueAttrsInFlight.value);
		}
	};

	const restartOnPageShow = (event: PageTransitionEvent): void => {
		// Only a restore from the back/forward cache leaves a stale session behind; on an ordinary
		// load `onMounted` has just started one.
		if (!event.persisted) return;
		restartYiviSessionIfWaiting();
	};

	// Try the step that failed again, from the button card 3 shows next to the error. A registration
	// is retried on the same terms as the attempt that failed, so an answer the user already gave to
	// the duplicate attribute dialog is not asked for again.
	const retryFailedStep = (): void => {
		const failed = retry.value;
		if (failed?.kind === 'card') {
			issuePubHubsCard(failed.comment);
		} else {
			startYiviSessionMSS(failed?.registerOnlyWithUniqueAttrs);
		}
	};

	onMounted(async () => {
		// The mobile and the desktop carousel each carry a mount point of their own, so
		// crossing the breakpoint destroys the element the widget rendered into and the session has
		// to be started again. Watching `isMobile` instead of `resize` keeps a mobile keyboard
		// opening or a collapsing URL bar from restarting a session that is running fine.
		watch(isMobile, () => restartYiviSessionIfWaiting(true));

		// The widget takes its language when it is constructed, so the one on screen keeps the texts
		// of the language the page has just left. The element it sits in stays, so an issuance that is
		// already up is left to finish in the old language rather than restarted.
		watch(
			() => settings.getActiveLanguage,
			() => restartYiviSessionIfWaiting(false),
		);

		// Registered before the session is awaited: that await only settles once the whole
		// registration is done, by which time this component is on its way out.
		window.addEventListener('pageshow', restartOnPageShow);

		await startYiviSessionMSS();
	});

	onUnmounted(() => {
		window.removeEventListener('pageshow', restartOnPageShow);
		// Leaving the page ends the attempt: an orphaned Yivi session keeps polling and would carry a
		// login that finished elsewhere into a navigation of its own. Bumping the counter keeps a step
		// that is still unwinding from writing to a card that is no longer on screen.
		currentRun++;
		mss.cancelEnter();
	});

	async function startYiviSessionMSS(registerOnlyWithUniqueAttrs = true) {
		const loginMethod = loginMethods.Yivi;
		// `AuthenticationServer` holds a single auth state, so a restart invalidates whatever the
		// previous run was still waiting on: only the newest run may show an error or navigate.
		const runId = ++currentRun;
		const superseded = () => runId !== currentRun;

		// A fresh attempt starts from a clean card: the error and the retry it offered belong to the
		// session this one replaces.
		error.value = undefined;
		retry.value = undefined;
		cardIssuanceInFlight.value = null;
		registerOnlyWithUniqueAttrsInFlight.value = registerOnlyWithUniqueAttrs;

		try {
			const errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.LoginOrRegister, yiviMountPoint, registerOnlyWithUniqueAttrs);
			if (superseded()) return;
			if (errorMessage?.key === 'errors.notid_attribute_already_taken') {
				handleDuplicateAttributeError();
				return;
			} else if (errorMessage?.key === 'errors.YiviServerGone' || errorMessage?.key === 'errors.card_not_added') {
				// Logged in, but without a usable PubHubs card - which is what a later login discloses.
				// Show what happened and give the card issuance one more Yivi session; the message stays
				// on the card, because it is what tells the user what that second session is for.
				error.value = errorMessage;
				await issuePubHubsCard(errorMessage.values?.[0] ?? '');
				return;
			} else if (errorMessage) {
				error.value = errorMessage;
				retry.value = { kind: 'registration', registerOnlyWithUniqueAttrs };
				return;
			}
			await finishOnboarding();
		} catch (err) {
			// Either a newer run replaced this one, or the page was left and the store cancelled it.
			// Both end the run without anything to show.
			if (superseded() || err instanceof EnterCancelled) return;
			router.push({ name: 'error' });
			logger.error('Error during MSS Registration', { err });
		}
	}

	/**
	 * Add the PubHubs card to the Yivi app of an account that is already entered.
	 *
	 * A failure is shown and offered as a retry rather than carried into the app: the card attribute
	 * is on the account, and the next login discloses exactly that card, so an account whose card
	 * never reached the Yivi app - or never reached the user secret - cannot log in again.
	 *
	 * @param comment The attributes the card is issued for, shown in the user's Yivi app.
	 */
	async function issuePubHubsCard(comment: string) {
		const runId = ++currentRun;
		const superseded = () => runId !== currentRun;

		// Stops the widget an earlier attempt left behind, so it neither keeps polling nor holds the
		// slot this one needs `cancelEnter()` to reach later.
		mss.cancelEnter();
		cardIssuanceInFlight.value = comment;

		// Whatever error explains this attempt stays on the card; only the button goes, so the session
		// now on screen cannot be started twice.
		retry.value = undefined;

		try {
			const { errorMessage } = await mss.issueCardAfterEntry(comment, yiviMountPoint);
			if (superseded()) return;
			cardIssuanceInFlight.value = null;
			if (errorMessage) {
				logger.error('Issuing the PubHubs card failed', { errorMessage });
				error.value = errorMessage;
				retry.value = { kind: 'card', comment };
				return;
			}
			error.value = undefined;
			await finishOnboarding();
		} catch (err) {
			if (superseded()) return;
			cardIssuanceInFlight.value = null;
			router.push({ name: 'error' });
			logger.error('Error while issuing the PubHubs card', { err });
		}
	}

	// Leave onboarding for wherever the user was headed.
	async function finishOnboarding() {
		if (redirectPath) {
			await router.push({ path: decodeURI(redirectPath) });
		} else {
			await router.push({ name: 'home' });
		}
	}

	async function handleDuplicateAttributeError() {
		dialog.okcancel(t('errors.notid_taken_title'), t('errors.notid_attribute_already_taken'));

		const handleOk = async () => {
			cleanup();
			startYiviSessionMSS(false);
		};

		const handleCancel = async () => {
			cleanup();
			startYiviSessionMSS(true);
		};

		const cleanup = () => {
			dialog.removeCallback(DialogOk);
			dialog.removeCallback(DialogCancel);
		};

		dialog.addCallback(DialogOk, handleOk);
		dialog.addCallback(DialogCancel, handleCancel);
	}
</script>

<style scoped>
	@keyframes card-shake {
		0%,
		100% {
			transform: translateX(0);
		}
		15% {
			transform: translateX(-6px);
		}
		30% {
			transform: translateX(6px);
		}
		45% {
			transform: translateX(-4px);
		}
		60% {
			transform: translateX(4px);
		}
		75% {
			transform: translateX(-2px);
		}
		90% {
			transform: translateX(2px);
		}
	}

	.card-shake {
		animation: card-shake 0.6s ease-in-out;
	}
</style>
