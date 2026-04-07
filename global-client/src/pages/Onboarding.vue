<template>
	<div class="flex w-full max-w-screen flex-col">
		<AuthHeader />

		<div class="h-[calc(100svh-80px)] overflow-y-auto">
			<!-- Registration section -->
			<section
				class="bg-background flex flex-col overflow-x-hidden"
				:class="isMobile ? 'h-[calc(100svh-7.5rem)] gap-4 py-4' : 'gap-8 py-16'"
			>
				<div
					class="flex shrink-0 flex-col"
					:class="isMobile ? 'h-full gap-4' : 'gap-8'"
				>
					<!-- Title -->
					<div class="mx-auto w-full max-w-[80ch]">
						<div
							class="flex flex-col gap-2"
							:class="isMobile && 'px-4'"
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
						class="flex h-full w-full max-w-screen flex-col gap-4 overflow-hidden"
						:class="isMobile && 'max-h-[calc(100svh-80px)]'"
					>
						<!-- Mobile -->
						<div
							v-if="isMobile"
							ref="carouselMobile"
							class="no-scrollbar flex h-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4"
						>
							<!-- Card 1 -->
							<CarouselCardMobile
								:index="0"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_1_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex h-full flex-col gap-2">
									<P>{{ $t('register.card_1_text_1', [$t('common.app_name'), $t('common.yivi')]) }}</P>
									<div class="flex h-full w-full items-center justify-center">
										<div class="w-full" />
										<DownloadLinks class="my-2 pr-8" />
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

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #image>
									<figure class="flex h-full w-full items-center justify-center">
										<img
											class="object-cover"
											src="../assets/mascot-attributes.svg"
										/>
									</figure>
								</template>
							</CarouselCardMobile>

							<!-- Card 3 -->
							<CarouselCardMobile
								:index="2"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_3_title') }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<div
										v-if="error"
										class="items-top bg-surface text-accent-error flex flex-row gap-x-2 rounded-xl py-2"
									>
										<Icon type="warning" />
										<P>{{ $t(error.key, error.values) }}</P>
									</div>

									<P>{{ $t('register.card_3_text_2', [$t('common.yivi'), $t('common.app_name')]) }}</P>
								</div>

								<template #extra>
									<div class="flex h-full w-full items-center justify-center">
										<div
											id="yivi-authentication"
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
							class="no-scrollbar flex snap-x snap-mandatory gap-12 overflow-x-auto scroll-smooth py-6"
							style="
								padding-left: max(1rem, calc(50vw - 40ch));
								padding-right: max(1rem, calc(50vw - 40ch));
								scroll-padding-left: max(1rem, calc(50vw - 40ch));
								scroll-padding-right: max(1rem, calc(50vw - 40ch));
							"
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

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_1_text_1', [$t('common.app_name'), $t('common.yivi')]) }}</P>
									<DownloadLinks class="my-2" />
									<H2>{{ $t('register.card_1_yivi', [$t('common.yivi')]) }}</H2>
									<P>{{ $t('register.card_1_yivi_text', [$t('common.yivi')]) }}</P>
								</div>

								<template #right>
									<figure class="flex h-full w-full items-center justify-center">
										<img
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

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #right>
									<figure class="flex h-full w-full items-center justify-center px-8 xl:px-24">
										<img
											class="object-cover"
											src="../assets/mascot-attributes.svg"
										/>
									</figure>
								</template>
							</CarouselCard>

							<!-- Card 3 -->
							<CarouselCard
								:active="currentIndex === 2"
								:class="currentIndex !== 2 && 'pointer-events-none'"
								:index="2"
								@next="scrollTo"
							>
								<template #title>
									<H2>{{ $t('register.card_3_title') }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_3_text_1') }}</P>
									<P class="mb-6">
										{{ $t('register.card_3_text_2', [$t('common.yivi'), $t('common.app_name')]) }}
									</P>

									<div
										v-if="error"
										class="items-top bg-surface text-accent-error flex flex-row gap-x-4 rounded-xl py-2"
									>
										<Icon
											class="mt-1"
											type="warning"
										/>
										<P class="mt-1">
											{{ $t(error.key, error.values) }}
										</P>
									</div>
								</div>

								<template #right>
									<div class="flex h-full w-full items-center justify-center">
										<div
											id="yivi-authentication"
											class="h-fit w-fit"
										/>
									</div>
								</template>
							</CarouselCard>
						</div>

						<!-- Page Indicators -->
						<div
							class="flex items-center justify-center gap-4"
							:class="isMobile ? 'py-0' : 'py-1'"
						>
							<div
								v-for="(item, index) in items"
								:key="index"
								class="h-3 w-3 rounded-full transition-all duration-300"
								:class="[currentIndex === index ? 'bg-accent-primary scale-110' : 'bg-surface-low', 'cursor-pointer']"
								@click="scrollTo(index)"
							/>
						</div>
					</div>
				</div>
			</section>

			<!-- Yivi section -->
			<section
				class="my-16 flex w-full flex-col items-center"
				:class="isMobile ? 'mb-16' : 'mb-32'"
			>
				<div class="flex w-full max-w-[80ch] flex-col gap-8">
					<div
						class="flex w-full"
						:class="isMobile && 'px-4'"
					>
						<H2>{{ $t('register.yivi_explained', [$t('common.yivi')]) }}</H2>
					</div>
					<iframe
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
						class="aspect-video w-full object-cover shadow-xl"
						:class="!isMobile && 'rounded-2xl'"
						frameborder="0"
						src="https://player.vimeo.com/video/807947893?badge=0&autopause=0&player_id=0&app_id=58479"
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

	// Components
	import AuthHeader from '@global-client/components/ui/onboarding/AuthHeader.vue';
	import CarouselCard from '@global-client/components/ui/onboarding/CarouselCard.vue';
	import CarouselCardMobile from '@global-client/components/ui/onboarding/CarouselCardMobile.vue';
	import DownloadLinks from '@global-client/components/ui/onboarding/DownloadLinks.vue';
	import FaqSection from '@global-client/components/ui/onboarding/FaqSection.vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { loginMethods } from '@global-client/models/MSS/TAuths';
	import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

	// Logic
	import { useMSS } from '@global-client/stores/mss';

	import { DialogCancel, DialogOk, useDialog } from '@hub-client/stores/dialog';
	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const error = ref();
	const dialog = useDialog();

	// Logging
	const logger = createLogger('Onboarding');

	// Reactive state
	const isMobile = computed(() => settings.isMobileState);
	const currentIndex = ref(0);
	const items = [1, 2, 3];

	// DOM refs for carousels
	const carouselMobile = ref<HTMLDivElement | null>(null);
	const carouselDesktop = ref<HTMLDivElement | null>(null);

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

	// Sets up a listener to track which carousel item is centered.
	const setupScrollListener = (): void => {
		const el = getCarouselRef();
		if (!el) return;

		el.addEventListener('scroll', () => {
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
		});
	};
	const handleResize = debounce(async () => {
		await startYiviSessionMSS();
	}, 300);

	onMounted(async () => {
		window.addEventListener('resize', handleResize);

		watch(
			isMobile,
			() => {
				setTimeout(setupScrollListener, 0);
			},
			{ immediate: true },
		);

		await startYiviSessionMSS();

		window.addEventListener('pageshow', async () => {
			await startYiviSessionMSS();
		});
	});

	onUnmounted(() => {
		window.removeEventListener('resize', handleResize);
	});

	// Lifecycle
	function debounce(fn: () => void, delay: number) {
		let timer: number;
		return () => {
			clearTimeout(timer);
			timer = window.setTimeout(fn, delay);
		};
	}

	async function startYiviSessionMSS(registerOnlyWithUniqueAttrs = true) {
		const loginMethod = loginMethods.Yivi; // If there will be multiple sources at a later point, this choice should be made by the user.

		try {
			const mss = useMSS();
			let errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.LoginOrRegister, registerOnlyWithUniqueAttrs);
			if (errorMessage?.key === 'errors.notid_attribute_already_taken') {
				handleDuplicateAttributeError();
				return;
			} else if (errorMessage) {
				error.value = errorMessage;
				return;
			}
			if (redirectPath) {
				await router.push({ path: decodeURI(redirectPath) });
			} else {
				await router.push({ name: 'home' });
			}
		} catch (error) {
			router.push({ name: 'error' });
			logger.error('Error during MSS Registration', { error });
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
