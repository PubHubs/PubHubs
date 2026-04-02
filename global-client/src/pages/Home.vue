<template>
	<div class="flex max-h-screen flex-col overflow-y-auto">
		<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center border-b px-8">
			<div class="flex items-center gap-2 whitespace-nowrap">
				<div class="flex items-center gap-2">
					<Icon class="text-on-surface" type="compass" size="md" />
					<div class="font-headings text-h3 font-semibold">{{ $t('home.discover_hubs') }}</div>
				</div>
			</div>
		</div>
		<div class="mx-auto mb-16 flex w-full flex-col gap-16 md:w-4/6">
			<div class="mt-4 flex flex-col gap-2 px-8 md:px-0">
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
				<div class="bg-surface-low rounded-xl px-8 py-8 md:px-12">
					<!-- Loading skeletons -->
					<div v-if="global.hubsLoading && filteredHubs.length === 0" class="3xl:grid-cols-3 grid w-full gap-8 md:grid-cols-2">
						<div v-for="n in 4" :key="n" class="bg-background h-60 w-full animate-pulse overflow-hidden rounded-xl shadow-md">
							<div class="bg-surface-high h-24 w-full"></div>
							<div class="flex items-start gap-4 px-4 py-2">
								<div class="bg-surface-high -mt-8 h-16 w-16 shrink-0 rounded-xl"></div>
								<div class="flex w-full flex-col gap-2 pt-1">
									<div class="bg-surface-high h-6 w-3/4 rounded"></div>
									<div class="bg-surface-high h-4 w-1/3 rounded"></div>
									<div class="bg-surface-high h-4 w-full rounded"></div>
									<div class="bg-surface-high h-4 w-2/3 rounded"></div>
								</div>
							</div>
						</div>
					</div>
					<!-- Hub cards -->
					<div v-else-if="filteredHubs.length > 0" class="3xl:grid-cols-3 grid w-full gap-8 md:grid-cols-2">
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

	import P from '@hub-client/components/elements/P.vue';

	// Logic
	import device from '@hub-client/logic/core/device';

	// Models
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
