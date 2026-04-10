<template>
	<div class="flex max-h-screen flex-col overflow-y-auto">
		<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center border-b px-8">
			<div class="flex items-center gap-2 whitespace-nowrap">
				<div class="flex items-center gap-2">
					<Icon
						class="text-on-surface"
						type="compass"
						size="md"
					/>
					<div class="font-headings text-h3 font-semibold">{{ $t('home.discover_hubs') }}</div>
				</div>
			</div>
		</div>
		<div class="mx-auto mb-16 flex w-full flex-col gap-10 px-8 md:w-4/6 md:px-0">
			<!-- Search bar -->
			<div class="mt-10">
				<div class="relative w-full md:ml-auto md:w-[320px]">
					<input
						v-model="searchQuery"
						class="outline-offset-thin outline-on-surface-dim focus:ring-button-blue text-on-surface placeholder-on-surface-dim w-full rounded px-175 py-100 pr-10 outline focus:ring-3 focus:outline-none"
						:placeholder="$t('others.search_hubs')"
						type="text"
					/>
					<Icon
						v-if="!searchQuery"
						type="magnifying-glass"
						size="sm"
						class="text-on-surface-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
					/>
					<button
						v-else
						type="button"
						class="text-on-surface-dim hover:text-on-surface absolute top-1/2 right-3 -translate-y-1/2"
						:aria-label="$t('others.clear_search')"
						@click="searchQuery = ''"
					>
						<Icon
							type="x"
							size="sm"
						/>
					</button>
				</div>
			</div>
			<div class="@container flex w-full flex-col gap-2">
				<!-- Loading skeletons -->
				<div
					v-if="global.hubsLoading && filteredHubs.length === 0"
					class="grid w-full grid-cols-1 gap-8 @2xl:grid-cols-2 @7xl:grid-cols-3"
				>
					<div
						v-for="n in 4"
						:key="n"
						class="bg-surface w-full animate-pulse overflow-hidden rounded-xl"
					>
						<div class="bg-surface-high h-30 w-full"></div>
						<div class="flex h-30 items-start gap-4 p-5 sm:p-6">
							<div class="bg-surface-high h-12 w-12 shrink-0 rounded-xl"></div>
							<div class="flex w-full flex-col gap-2 pt-1">
								<div class="bg-surface-high h-4 w-3/4 rounded"></div>
								<div class="bg-surface-high h-3 w-full rounded"></div>
								<div class="bg-surface-high h-3 w-2/3 rounded"></div>
							</div>
						</div>
					</div>
				</div>
				<!-- Hub cards -->
				<div
					v-else-if="filteredHubs.length > 0"
					class="grid w-full grid-cols-1 gap-8 @2xl:grid-cols-2 @7xl:grid-cols-3"
				>
					<HubBlock
						v-for="hub in filteredHubs"
						:key="hub.hubId"
						:hub="hub"
					/>
				</div>
				<div
					v-else
					class="flex w-full items-center justify-center"
				>
					<P>{{ $t('others.search_hubs_not_found') }}</P>
				</div>
			</div>
		</div>
		<InstallPrompt
			:browser="device.getBrowserName()"
			:operating-system="device.getMobileOS()"
		/>
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
	import { type Hub } from '@global-client/models/Hubs';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	const global = useGlobal();
	const hubs = useHubs();

	const searchQuery = ref<string>('');

	const filteredHubs = computed(() => {
		return hubs.activeHubs.filter(
			(hub: Hub) =>
				hub.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || hub.description.toLowerCase().includes(searchQuery.value.toLowerCase()),
		);
	});
</script>
