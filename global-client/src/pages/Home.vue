<template>
	<div class="flex max-h-screen flex-col overflow-y-auto">
		<div class="border-on-surface-disabled/25 flex h-[80px] shrink-0 items-center border-b-2 px-400">
			<div class="flex items-center gap-100 whitespace-nowrap">
				<div class="flex items-center gap-100">
					<Icon
						class="text-on-surface"
						type="compass"
					/>
					<div class="font-headings text-h3 font-semibold">{{ $t('home.discover_hubs') }}</div>
				</div>
			</div>
		</div>
		<div class="mx-auto mb-800 flex w-full flex-col gap-500 px-400 md:w-4/6 md:px-0">
			<!-- Search bar -->
			<div class="mt-500">
				<div class="relative w-full md:ml-auto md:w-[320px]">
					<input
						v-model="searchQuery"
						class="outline-offset-thin outline-on-surface-dim focus:ring-accent-blue-interactive text-on-surface placeholder-on-surface-dim w-full rounded px-175 py-100 pr-500 outline focus:ring-3 focus:outline-none"
						:placeholder="$t('others.search_hubs')"
						type="text"
					/>
					<Icon
						v-if="!searchQuery"
						type="magnifying-glass"
						size="sm"
						class="text-on-surface-dim pointer-events-none absolute top-1/2 right-100 -translate-y-1/2"
					/>
					<button
						v-else
						type="button"
						class="text-on-surface-dim hover:text-on-surface absolute top-1/2 right-100 -translate-y-1/2"
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
			<div class="@container flex w-full flex-col gap-100">
				<!-- Loading skeletons -->
				<div
					v-if="global.hubsLoading && filteredHubs.length === 0"
					class="grid w-full grid-cols-1 gap-400 @2xl:grid-cols-2 @7xl:grid-cols-3"
				>
					<div
						v-for="n in 4"
						:key="n"
						class="bg-surface w-full animate-pulse overflow-hidden rounded-xl"
					>
						<div class="bg-surface-base h-2000 w-full"></div>
						<div class="flex h-2000 items-start gap-200 p-250 sm:p-300">
							<div class="bg-surface-base h-600 w-600 shrink-0 rounded-xl"></div>
							<div class="pt-050 flex w-full flex-col gap-100">
								<div class="bg-surface-base h-200 w-3/4 rounded"></div>
								<div class="bg-surface-base h-150 w-full rounded"></div>
								<div class="bg-surface-base h-150 w-2/3 rounded"></div>
							</div>
						</div>
					</div>
				</div>
				<!-- Hub cards -->
				<div
					v-else-if="filteredHubs.length > 0"
					class="grid w-full grid-cols-1 gap-400 @2xl:grid-cols-2 @7xl:grid-cols-3"
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

	import Icon from '@hub-client/components/elements/Icon.vue';
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
