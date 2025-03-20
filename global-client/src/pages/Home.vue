<template>
	<!-- Page when logged-out -->
	<div v-if="!global.loggedIn">
		<div class="h-[15svh] min-h-[150px] w-full">
			<ImagePlaceholder source="/client/img/imageplaceholder.jpg" />
		</div>
		<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
			<div class="mt-16 flex flex-col items-center justify-start gap-16 px-4 md:px-0">
				<div class="flex flex-col items-center gap-8 md:flex-row">
					<div class="work_sanssemibold text-4xl md:text-6xl 2xl:text-8xl">{{ $t('home.welcome_to') }}</div>
					<Logo class="h-24"></Logo>
				</div>
				<div class="flex w-full flex-col items-start gap-8 md:flex-row">
					<div class="flex w-full flex-col items-center justify-center gap-4">
						<Button class="w-full md:px-12" @click="loadYivi">{{ $t('login.global_login') }}</Button>
						<div v-show="show" class="relative w-fit">
							<Icon type="close" class="absolute right-2 top-8 z-10 cursor-pointer dark:text-black" @click="closeYivi"></Icon>
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
		<div class="h-[15svh] min-h-[150px] w-full">
			<ImagePlaceholder source="/client/img/imageplaceholder.jpg" />
		</div>
		<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
			<div class="-mt-16 flex flex-col gap-2 px-8 md:px-0">
				<div class="flex items-center gap-2">
					<Icon class="text-ph-background-2 dark:text-ph-text" type="pubhubs-home" size="sm"></Icon>
					<div class="work_sanssemibold text-2xl">{{ $t('home.welcome_to') }}</div>
					<Logo class="w-[8em]"></Logo>
				</div>
				<div class="relative">
					<input
						type="text"
						v-model="searchQuery"
						:placeholder="$t('others.search_hubs')"
						class="bg-ph-accent-icon-1 focus mb-4 w-full rounded border px-4 py-2 text-ph-background-5 placeholder-ph-background-5 focus:placeholder-ph-background focus:ring-ph-accent"
					/>
					<Icon type="search" class="pointer-events-none absolute right-4 top-[25%] z-10 text-ph-background-5" size="sm" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2 px-8 md:px-0">
					<Icon class="text-ph-background-3 dark:text-ph-text" type="pubhubs-home" size="sm"></Icon>
					<div class="work_sanssemibold text-2xl">{{ $t('home.discover_hubs') }}</div>
				</div>
				<div class="rounded-xl bg-ph-background-4 px-8 py-8 md:px-12">
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
	import { useGlobal, useHubs } from '@/logic/store/store';
	import { computed, ref } from 'vue';
	import { yivi } from '@/yivi';

	import ImagePlaceholder from '../../../hub-client/src/components/elements/ImagePlaceholder.vue';

	const global = useGlobal();
	const hubs = useHubs();

	const show = ref<Boolean>(false);
	const yivi_token = ref<string>('');
	const searchQuery = ref<string>('');

	const filteredHubs = computed(() => {
		return hubs.activeHubs.filter((hub) => hub.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || hub.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
	});

	function loadYivi() {
		show.value = !show.value;
		yivi(false, yivi_token);
	}

	function closeYivi() {
		show.value = false;
	}

	window.addEventListener('pageshow', () => (show.value = false));
</script>
