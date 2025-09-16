<template>
	<div class="max-h-screen overflow-y-auto">
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
					<InlineSpinner v-else-if="loading" />
					<div v-else class="flex w-full items-center justify-center">
						<P>{{ $t('others.search_hubs_not_found') }}</P>
					</div>
				</div>
			</div>
		</div>
		<InstallPrompt :browser="device.getBrowserName()" :operating-system="device.getMobileOS()" />
	</div>
</template>

<script setup lang="ts">
	// Package imports
	import { computed, onMounted, ref } from 'vue';
	import { useRouter } from 'vue-router';

	// Global imports
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { useGlobal } from '@/logic/store/global';
	import { useHubs } from '@/logic/store/hubs';
	import { Hub } from '@/model/Hubs';
	import InstallPrompt from '@/components/ui/InstallPrompt.vue';
	import HubBlock from '@/components/ui/HubBlock.vue';
	import Logo from '@/components/ui/Logo.vue';

	// Hub imports
	import HubBanner from '@/../../hub-client/src/components/ui/HubBanner.vue';
	import InlineSpinner from '@/../../hub-client/src/components/ui/InlineSpinner.vue';
	import Icon from '@/../../hub-client/src/components/elements/Icon.vue';
	import P from '@/../../hub-client/src/components/elements/P.vue';
	import device from '@/../../hub-client/src/logic/core/device';

	const global = useGlobal();
	const hubs = useHubs();

	const router = useRouter();

	const loading = ref<boolean>(true);

	onMounted(async () => {
		await addHubs();

		if (!hubs.hasHubs) {
			router.push({ name: 'error', query: { errorKey: 'errors.no_hubs_found' } });
		}
	});

	// Function to add hubs
	async function addHubs() {
		try {
			loading.value = true;
			const hubsResponse = await global.getHubs();
			if (hubsResponse) {
				hubs.addHubs(hubsResponse);
			}
		} catch (error) {
			router.push({ name: 'error', query: { errorKey: 'errors.no_hubs_found' } });
			LOGGER.error(SMI.ERROR, 'Error adding hubs', { error });
		} finally {
			loading.value = false;
		}
	}

	const searchQuery = ref<string>('');

	const filteredHubs = computed(() => {
		return hubs.activeHubs.filter((hub: Hub) => hub.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || hub.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
	});
</script>
