<template>
	<!-- Page when logged-out -->
	<div v-if="!global.loggedIn">
		<HubBanner />
		<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
			<div class="mt-16 flex flex-col items-center justify-start gap-16 px-4 md:px-0">
				<div class="flex items-center whitespace-nowrap ~gap-2/4">
					<div class="flex items-center gap-2">
						<Icon class="text-surface dark:text-on-surface" type="pubhubs-home" size="md" />
						<div class="font-headings font-semibold ~text-h1-min/h1-max">{{ $t('home.welcome_to') }}</div>
					</div>
					<div class="object-contain ~h-6/12">
						<Logo />
					</div>
				</div>
				<div class="flex w-full flex-col items-start gap-8 md:flex-row">
					<div class="flex w-full flex-col items-center justify-center gap-4">
						<Button class="w-full md:px-12" @click="loadYivi">{{ $t('login.global_login') }}</Button>
						<div v-show="show" class="relative w-fit">
							<Icon type="close" class="absolute right-2 top-8 z-10 cursor-pointer dark:text-black" @click="closeYivi" />
							<div
								id="yivi-login"
								class="relative top-6 !mb-6 w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
							>
								<!-- Yivi content -->
							</div>
						</div>
					</div>
					<router-link to="/register" class="w-full">
						<Button :color="'blue'" class="" @click="false">{{ $t('register.register_with') }} PubHubs</Button>
					</router-link>
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
	</div>

	<form v-if="show" method="POST" action="/yivi-endpoint/finish-and-redirect">
		<input type="hidden" name="yivi_token" :value="yivi_token" />
	</form>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import Logo from '@/components/ui/Logo.vue';
	import { useGlobal, useHubs } from '@/logic/store/store';
	import startYiviSession from '@/logic/utils/yiviHandler';

	import HubBanner from '../../../hub-client/src/components/ui/HubBanner.vue';

	const global = useGlobal();
	const hubs = useHubs();

	const show = ref<Boolean>(false);
	const yivi_token = ref<string>('');
	const searchQuery = ref<string>('');

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

	function closeYivi() {
		show.value = false;
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
