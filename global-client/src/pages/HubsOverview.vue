<template>
	<HubsPageLayout
		icon="house"
		:title="$t('home.hubs_overview')"
	>
		<FilterableList
			:filter-keys="['name', 'description']"
			:items="selectedList as unknown as Array<Record<string, unknown>>"
			:paginate="false"
			:placeholder="$t('others.search_hubs')"
		>
			<template #actions>
				<ButtonGroup
					class="w-full"
					:combined="true"
				>
					<Button
						icon="push-pin"
						:aria-current="!discoverTab ? 'page' : undefined"
						:variant="!discoverTab ? 'primary' : 'secondary'"
						@click="discoverTab = false"
						>{{ $t('home.pinned') }}</Button
					>
					<Button
						icon="compass"
						:aria-current="discoverTab ? 'page' : undefined"
						:variant="discoverTab ? 'primary' : 'secondary'"
						@click="discoverTab = true"
						>{{ $t('home.discover') }}</Button
					>
				</ButtonGroup>
			</template>
			<template #filtered="{ items }">
				<HubGrid
					:hubs="items as unknown as Hub[]"
					:loading="global.hubsLoading"
					:skeleton-count="2"
				/>
			</template>
			<template #empty>
				<div
					v-if="discoverTab && !global.hubsLoading && allHubsFailed"
					class="flex flex-col items-center gap-200"
				>
					<P class="text-center">{{ $t('home.load_hubs_failed') }}</P>
					<Button
						variant="secondary"
						@click="loadAllHubs"
						>{{ $t('common.retry') }}</Button
					>
				</div>
				<P
					v-else-if="discoverTab && !global.hubsLoading"
					class="text-center"
					>{{ hasPinnedHubs ? $t('home.pinned_all_hubs') : $t('home.no_hubs_available') }}</P
				>
				<!-- Empty grid still renders the loading skeletons, and the 'add hub' card on the pinned tab -->
				<HubGrid
					v-else
					:hubs="[]"
					:loading="global.hubsLoading"
					:skeleton-count="2"
				>
					<template #append>
						<AddHubBlock
							v-if="!discoverTab && !global.hubsLoading"
							@discover="discoverTab = true"
						/>
					</template>
				</HubGrid>
			</template>
		</FilterableList>
	</HubsPageLayout>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref, watch } from 'vue';

	// Components
	import AddHubBlock from '@global-client/components/ui/AddHubBlock.vue';
	import HubGrid from '@global-client/components/ui/HubGrid.vue';
	import HubsPageLayout from '@global-client/components/ui/HubsPageLayout.vue';

	import Button from '@hub-client/components/elements/Button.vue';
	import ButtonGroup from '@hub-client/components/elements/ButtonGroup.vue';
	import P from '@hub-client/components/elements/P.vue';
	import FilterableList from '@hub-client/components/ui/FilterableList.vue';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type Hub } from '@global-client/models/Hubs';

	// Stores
	import { useGlobal } from '@global-client/stores/global';
	import { useHubs } from '@global-client/stores/hubs';

	const global = useGlobal();
	const hubs = useHubs();
	const logger = createLogger('HubsOverview');

	const pinnedHubIds = computed(() => new Set(global.pinnedHubs.map((h) => h.hubId)));

	const selectedList = computed(() => hubs.activeHubs.filter((hub: Hub) => pinnedHubIds.value.has(hub.hubId) !== discoverTab.value));

	// An empty discover tab only means 'all pinned' when something is pinned; otherwise there are simply no hubs.
	const hasPinnedHubs = computed(() => hubs.activeHubs.some((hub: Hub) => pinnedHubIds.value.has(hub.hubId)));

	const discoverTab = ref<boolean>(false);
	const allHubsLoaded = ref<boolean>(false);
	const allHubsFailed = ref<boolean>(false);

	// Pinned hubs are loaded at startup; only the discover tab needs every hub, so fetch them when it
	// opens. A failed load is tried again the next time the tab opens.
	watch(discoverTab, (open) => {
		if (open && !allHubsLoaded.value) loadAllHubs();
	});

	async function loadAllHubs() {
		allHubsFailed.value = false;
		try {
			await global.getAllHubs();
			allHubsLoaded.value = true;
		} catch (error) {
			allHubsFailed.value = true;
			logger.error('Could not load all hubs', { error });
		}
	}
</script>
