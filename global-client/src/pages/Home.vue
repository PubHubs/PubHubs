<template>
	<div class="max-h-screen overflow-y-auto">
		<HubBanner />
		<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
			<div class="-mt-[5.5rem] flex flex-col gap-2 px-8 md:px-0">
				<div class="flex items-center gap-2 whitespace-nowrap">
					<div class="flex items-center gap-2">
						<Icon class="text-surface dark:text-on-surface" type="compass" size="md" />
						<div class="font-headings text-h3 font-semibold">{{ $t('home.welcome_to') }}</div>
					</div>
					<div class="h-8 object-contain">
						<Logo />
					</div>
				</div>
				<div class="relative">
					<input
						type="text"
						v-model="searchQuery"
						:placeholder="$t('others.search_hubs')"
						class="focus bg-surface text-on-surface placeholder-on-surface-dim text-label focus:placeholder-on-surface-variant focus:ring-accent-primary mb-4 w-full rounded-xs border px-4 py-2"
					/>
					<Icon type="magnifying-glass" class="text-on-surface-variant pointer-events-none absolute top-[20%] right-2 z-10" size="sm" />
				</div>
			</div>
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2 px-8 md:px-0">
					<Icon class="text-surface dark:text-on-surface" type="compass" size="md" />
					<div class="font-headings text-h3 font-semibold">{{ $t('home.discover_hubs') }}</div>
					<InlineSpinner v-if="global.hubsLoading" />
				</div>
				<div class="bg-surface-low rounded-xl px-8 py-8 md:px-12">
					<div v-if="filteredHubs.length > 0" class="3xl:grid-cols-3 grid w-full gap-8 md:grid-cols-2">
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
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	// Components
	import HubBlock from '@global-client/components/ui/HubBlock.vue';
	import InstallPrompt from '@global-client/components/ui/InstallPrompt.vue';
	import Logo from '@global-client/components/ui/Logo.vue';

	import P from '@hub-client/components/elements/P.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Logic
	import device from '@hub-client/logic/core/device';

	import { Hub } from '@global-client/models/Hubs';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	const global = useGlobal();
	const hubs = useHubs();
	const searchQuery = ref<string>('');

	const filteredHubs = computed(() => {
		return hubs.activeHubs.filter((hub: Hub) => hub.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || hub.description.toLowerCase().includes(searchQuery.value.toLowerCase()));
	});
</script>
