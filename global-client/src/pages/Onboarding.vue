<template>
	<div class="w-full max-w-screen">
		<!-- Header -->
		<div class="bg-surface flex w-full items-center px-6 py-4" :class="isMobile ? 'h-[7.5rem]' : 'h-[10rem]'">
			<div class="flex h-full w-full items-center justify-between gap-16">
				<a :href="globalClientUrl" target="_blank" rel="noopener noreferrer" class="h-full py-2">
					<Logo />
				</a>
				<div class="flex h-4 items-center justify-center gap-2">
					<p class="hover:text-accent-primary cursor-pointer font-bold" @click="changeLanguage('nl')">NL</p>
					<span>|</span>
					<p class="hover:text-accent-primary cursor-pointer font-bold" @click="changeLanguage('en')">EN</p>
				</div>
			</div>
		</div>

		<div class="overflow-y-auto" :class="isMobile ? 'h-[calc(100svh_-_7.5rem)]' : 'h-[calc(100svh_-_10rem)]'">
			<!-- Registration section -->
			<section class="bg-background flex flex-col gap-8 overflow-x-hidden" :class="isMobile ? 'h-[calc(100svh_-_7.5rem)] py-8' : 'py-16'">
				<div class="flex shrink-0 flex-col gap-8" :class="isMobile && 'h-full'">
					<!-- Title -->
					<div class="mx-auto w-full max-w-[80ch]">
						<div class="flex flex-col gap-2" :class="isMobile && 'px-4'">
							<P class="font-semibold">{{ $t('register.no_account_yet', [$t('common.app_name')]) }}</P>
							<H1>{{ $t('register.register_3_steps', [$t('common.app_name')]) }}</H1>
						</div>
					</div>

					<!-- Carousel -->
					<div class="flex h-full w-full max-w-screen flex-col gap-4 overflow-hidden" :class="isMobile && 'max-h-[calc(100svh_-_7.5rem)]'">
						<!-- Mobile -->
						<div v-if="isMobile" ref="carouselMobile" class="no-scrollbar flex h-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4">
							<!-- Card 1 -->
							<CarouselCardMobile :index="0" @next="scrollTo">
								<template #title>
									<H2>{{ $t('register.card_1_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex h-full flex-col gap-2">
									<P>{{ $t('register.card_1_text_1', [$t('common.app_name'), $t('common.yivi')]) }}</P>
									<div class="flex h-full w-full items-center justify-center">
										<div class="w-full"></div>
										<DownloadLinks class="my-2 pr-8" />
										<div class="w-full"></div>
									</div>
								</div>
							</CarouselCardMobile>

							<!-- Card 2 -->
							<CarouselCardMobile :index="1" @next="scrollTo">
								<template #title>
									<H2>{{ $t('register.card_2_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #image>
									<figure class="flex h-full w-full items-center justify-center">
										<img src="../assets/mascot-attributes.svg" class="object-cover" />
									</figure>
								</template>
							</CarouselCardMobile>

							<!-- Card 3 -->
							<CarouselCardMobile :index="2" @next="scrollTo">
								<template #title>
									<H2>{{ $t('register.card_3_title') }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<div v-if="error" class="items-top bg-surface text-accent-error flex flex-row gap-x-2 rounded-xl py-2">
										<Icon type="warning"></Icon>
										<P>{{ $t(error.key, error.values) }}</P>
									</div>

									<P>{{ $t('register.card_3_text_1') }}</P>
									<P>{{ $t('register.card_3_text_2', [$t('common.yivi'), $t('common.app_name')]) }}</P>
								</div>

								<template #extra>
									<div class="flex h-full w-full items-center justify-center">
										<div id="yivi-authentication" class="aspect-square w-full"></div>
									</div>
								</template>
							</CarouselCardMobile>
						</div>

						<!-- Desktop -->
						<div
							v-else
							ref="carouselDesktop"
							class="no-scrollbar flex snap-x snap-mandatory gap-12 overflow-x-auto scroll-smooth py-6"
							style="padding-left: calc(50vw - 40ch); padding-right: calc(50vw - 40ch); scroll-padding-left: calc(50vw - 40ch); scroll-padding-right: calc(50vw - 40ch)"
						>
							<!-- Card 1 -->
							<CarouselCard :index="0" @next="scrollTo" :class="currentIndex !== 0 && 'pointer-events-none'">
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
										<img src="../assets/laptop.svg" class="object-cover" />
									</figure>
								</template>
							</CarouselCard>

							<!-- Card 2 -->
							<CarouselCard :index="1" @next="scrollTo" :class="currentIndex !== 1 && 'pointer-events-none'">
								<template #title>
									<H2>{{ $t('register.card_2_title', [$t('common.yivi')]) }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_2_text_1', [$t('common.yivi')]) }}</P>
									<P>{{ $t('register.card_2_text_2', [$t('common.yivi')]) }}</P>
								</div>

								<template #right>
									<figure class="flex h-full w-full items-center justify-center px-8 xl:px-24">
										<img src="../assets/mascot-attributes.svg" class="object-cover" />
									</figure>
								</template>
							</CarouselCard>

							<!-- Card 3 -->
							<CarouselCard :index="2" @next="scrollTo" :class="currentIndex !== 2 && 'pointer-events-none'">
								<template #title>
									<H2>{{ $t('register.card_3_title') }}</H2>
								</template>

								<div class="flex flex-col gap-2">
									<P>{{ $t('register.card_3_text_1') }}</P>
									<P class="mb-6">{{ $t('register.card_3_text_2', [$t('common.yivi'), $t('common.app_name')]) }}</P>

									<div v-if="error" class="items-top bg-surface text-accent-error flex flex-row gap-x-4 rounded-xl py-2">
										<Icon type="warning" class="mt-1"></Icon>
										<P class="mt-1"> {{ $t(error.key, error.values) }}</P>
									</div>
								</div>

								<template #right>
									<div class="flex h-full w-full items-center justify-center">
										<div id="yivi-authentication" class="h-fit w-fit"></div>
									</div>
								</template>
							</CarouselCard>
						</div>

						<!-- Page Indicators -->
						<div class="flex items-center justify-center gap-4 py-1">
							<div
								v-for="(item, index) in items"
								:key="index"
								class="h-3 w-3 rounded-full transition-all duration-300"
								:class="[currentIndex === index ? 'bg-accent-primary scale-110' : 'bg-surface-low', 'cursor-pointer']"
								@click="scrollTo(index)"
							></div>
						</div>
					</div>
				</div>
			</section>

			<!-- Yivi section -->
			<section class="my-16 flex w-full flex-col items-center" :class="isMobile ? 'mb-16' : 'mb-32'">
				<div class="flex w-full max-w-[80ch] flex-col gap-8">
					<div class="flex w-full" :class="isMobile && 'px-4'">
						<H2>{{ $t('register.yivi_explained', [$t('common.yivi')]) }}</H2>
					</div>
					<iframe
						:class="!isMobile && 'rounded-2xl'"
						class="aspect-video object-cover shadow-xl"
						width="100%"
						height="100%"
						src="https://player.vimeo.com/video/807947893?badge=0&autopause=0&player_id=0&app_id=58479"
						title="Vimeo video player"
						frameborder="0"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						allowfullscreen
					></iframe>
					<div class="mt-4 flex flex-col gap-8 px-4">
						<div class="flex items-center gap-4">
							<div class="bg-accent-primary text-on-accent-primary flex aspect-square h-6 w-6 items-center justify-center rounded-full">
								<span class="text-label-small font-semibold">i</span>
							</div>
							<H2>{{ $t('register.yivi_faq') }}</H2>
						</div>
						<div class="flex flex-col gap-4">
							<div v-for="(item, index) in faqs" :key="index" class="bg-surface-low flex w-full flex-col gap-2 rounded-2xl">
								<div class="flex w-full justify-between rounded-2xl px-4 py-2 font-semibold hover:cursor-pointer" :class="faqIndex === index && 'bg-surface'" @click="toggle(index)">
									<span>{{ item.question }}</span>
									<span>{{ faqIndex === index ? '−' : '+' }}</span>
								</div>
								<div v-if="faqIndex === index" class="p-4">
									{{ item.answer }}
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import Logo from '@global-client/components/ui/Logo.vue';
	import CarouselCard from '@global-client/components/ui/onboarding/CarouselCard.vue';
	import CarouselCardMobile from '@global-client/components/ui/onboarding/CarouselCardMobile.vue';
	import DownloadLinks from '@global-client/components/ui/onboarding/DownloadLinks.vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import { CONFIG } from '@hub-client/logic/logging/Config';
	import { Logger } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { loginMethods } from '@global-client/models/MSS/TAuths';
	import { PHCEnterMode } from '@global-client/models/MSS/TPHC';

	// Logic
	import { useMSS } from '@global-client/stores/mss';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const { t } = useI18n();
	const router = useRouter();
	const route = useRoute();
	const error = ref();

	// Logging
	const LOGGER = new Logger('GC', CONFIG);

	// Reactive state
	const globalClientUrl: string = _env.PUBHUBS_URL;
	const isMobile = computed(() => settings.isMobileState);
	const currentIndex = ref(0);
	const faqIndex = ref<number | null>(null);
	const items = [1, 2, 3];

	// DOM refs for carousels
	const carouselMobile = ref<HTMLDivElement | null>(null);
	const carouselDesktop = ref<HTMLDivElement | null>(null);

	// Query parameters
	const redirectPath = route.query.redirectPath as string;
	// FAQ
	const faqs = computed(() => [
		{
			question: t('register.yivi_faq_1_question'),
			answer: t('register.yivi_faq_1_answer'),
		},
		{
			question: t('register.yivi_faq_2_question'),
			answer: t('register.yivi_faq_2_answer'),
		},
		{
			question: t('register.yivi_faq_3_question'),
			answer: t('register.yivi_faq_3_answer'),
		},
		{
			question: t('register.yivi_faq_4_question'),
			answer: t('register.yivi_faq_4_answer'),
		},
		{
			question: t('register.yivi_faq_5_question'),
			answer: t('register.yivi_faq_5_answer'),
		},
	]);

	// Toggles Faq
	function toggle(index: number) {
		faqIndex.value = faqIndex.value === index ? null : index;
	}

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

	// Change application language.
	const changeLanguage = (language: string): void => {
		settings.setLanguage(language, true);
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

	// Lifecycle
	function debounce(fn: () => void, delay: number) {
		let timer: number;
		return () => {
			clearTimeout(timer);
			timer = window.setTimeout(fn, delay);
		};
	}

	async function startYiviSessionMSS() {
		const loginMethod = loginMethods.Yivi; // If there will be multiple sources at a later point, this choice should be made by the user.

		try {
			const mss = useMSS();
			const errorMessage = await mss.enterPubHubs(loginMethod, PHCEnterMode.LoginOrRegister);
			if (errorMessage) {
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
			LOGGER.error(SMI.ERROR, 'Error during MSS Registration', { error });
		}
	}

	const handleResize = debounce(async () => {
		await startYiviSessionMSS();
	}, 300);

	onMounted(async () => {
		window.addEventListener('resize', handleResize);

		await startYiviSessionMSS();

		window.addEventListener('pageshow', async () => {
			await startYiviSessionMSS();
		});

		watch(
			isMobile,
			() => {
				setTimeout(setupScrollListener, 0);
			},
			{ immediate: true },
		);
	});

	onUnmounted(() => {
		window.removeEventListener('resize', handleResize);
	});
</script>
