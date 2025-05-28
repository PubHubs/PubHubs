<template>
	<!-- Page when logged-out -->
	<div v-if="!global.loggedIn" class="">
		<div class="flex w-full items-center bg-surface px-6 py-4" :class="isMobile ? 'h-[7.5rem]' : 'h-[10rem]'">
			<div class="flex h-full w-full items-center justify-between gap-16">
				<a :href="pubHubsUrl" target="_blank" rel="noopener noreferrer" class="h-full py-2">
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
						<div class="flex flex-col ~gap-2/4" @click="loadYivi">
							<div v-show="show" class="relative flex w-full items-center justify-center" :class="isMobile ? '-mb-2' : '-mb-4'">
								<div
									id="yivi-login"
									class="absolute bottom-8 left-0 z-50 w-full after:absolute after:-bottom-[1.2em] after:right-[50%] after:border-[1.25em] after:border-b-0 after:border-l-0 after:border-transparent after:border-t-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
								></div>
							</div>
							<Button color="gray">{{ show ? $t('dialog.close') : $t('login.login') }}</Button>
							<router-link to="/register" class="w-full">
								<Button>{{ $t('register.register_with', [$t('common.yivi')]) }}</Button>
							</router-link>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Page when logged-in -->
	<div v-else>
		<HubBanner />
		<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
			<div class="-mt-[5.5rem] flex flex-col gap-2 px-8 md:px-0">
				<div class="flex items-center whitespace-nowrap ~gap-1/4">
					<div class="flex items-center gap-2">
						<Icon class="text-surface dark:text-on-surface" type="pubhubs-home" size="md" />
						<div class="font-headings font-semibold ~text-h3-min/h3-max">{{ $t('home.welcome_to') }}</div>
					</div>
					<div class="object-contain ~h-6/12">
						<Logo />
					</div>
				</div>
				<div class="relative">
					<input
						type="text"
						v-model="searchQuery"
						:placeholder="$t('others.search_hubs')"
						class="focus mb-4 w-full rounded border bg-surface px-4 py-2 text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:placeholder-on-surface-variant focus:ring-accent-primary"
					/>
					<Icon type="search" class="pointer-events-none absolute right-2 top-[20%] z-10 text-on-surface-variant" size="sm" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2 px-8 md:px-0">
					<Icon class="text-surface dark:text-on-surface" type="pubhubs-home" size="md" />
					<div class="font-headings font-semibold ~text-h3-min/h3-max">{{ $t('home.discover_hubs') }}</div>
				</div>
				<div class="rounded-xl bg-surface-low px-8 py-8 md:px-12">
					<div v-if="filteredHubs.length > 0" class="grid w-full gap-8 md:grid-cols-2 3xl:grid-cols-3">
						<div v-for="hub in filteredHubs" v-bind:key="hub.hubId">
							<HubBlock :hub="hub" />
						</div>
					</div>
					<div v-else class="flex w-full items-center justify-center">
						<P>{{ $t('others.search_hubs_not_found') }}</P>
					</div>
				</div>
			</div>
		</div>
		<InstallPrompt :browser="device.getBrowserName()" :operating-system="device.getMobileOS()" />
	</div>

	<form v-if="show" method="POST" action="/yivi-endpoint/finish-and-redirect">
		<input type="hidden" name="yivi_token" :value="yivi_token" />
	</form>
</template>

<script setup lang="ts">
	// Package imports
	import { computed, ref } from 'vue';

	// Global imports
	import InstallPrompt from '@/components/ui/InstallPrompt.vue';
	import Logo from '@/components/ui/Logo.vue';
	import { useGlobal, useHubs, useSettings } from '@/logic/store/store';
	import startYiviSession from '@/logic/utils/yiviHandler';

	// Hub imports
	import HubBanner from '@/../../hub-client/src/components/ui/HubBanner.vue';
	import H1 from '../../../hub-client/src/components/elements/H1.vue';
	import P from '../../../hub-client/src/components/elements/P.vue';

	import device from '@/../../hub-client/src/logic/core/device';

	const global = useGlobal();
	const hubs = useHubs();
	const settings = useSettings();

	const pubHubsUrl = _env.PUBHUBS_URL;
	const show = ref<Boolean>(false);
	const yivi_token = ref<string>('');
	const searchQuery = ref<string>('');
	const isMobile = computed(() => settings.isMobileState);

	const filteredHubs = computed(() => {
		return hubs.activeHubs.filter((hub) => hub.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || hub.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
	});

	const loadYivi = () => {
		show.value = !show.value;

		try {
			startYiviSession(false, yivi_token);
		} catch (error) {
			console.error('Yivi session load failed:', error);
		}
	};

	function changeLanguage(language: string) {
		settings.setLanguage(language, true);
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
