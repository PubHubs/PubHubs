<template>
	<div class="@container flex w-full flex-col gap-100">
		<!-- Loading skeletons -->
		<div
			v-if="loading && hubs.length === 0"
			class="grid w-full grid-cols-1 gap-400 @2xl:grid-cols-2 @7xl:grid-cols-3"
		>
			<HubBlockSkeleton
				v-for="n in skeletonCount"
				:key="n"
			/>
		</div>
		<!-- Hub cards -->
		<div
			v-else
			class="grid w-full grid-cols-1 gap-400 @2xl:grid-cols-2 @7xl:grid-cols-3"
		>
			<HubBlock
				v-for="hub in hubs"
				:key="hub.hubId"
				:hub="hub"
			/>
			<!-- Lets a page add a trailing card (e.g. the 'add hub' placeholder) inside the same grid. -->
			<slot name="append" />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import HubBlock from '@global-client/components/ui/HubBlock.vue';
	import HubBlockSkeleton from '@global-client/components/ui/HubBlockSkeleton.vue';

	// Models
	import { type Hub } from '@global-client/models/Hubs';

	// Props
	withDefaults(
		defineProps<{
			hubs: Hub[];
			loading?: boolean;
			skeletonCount?: number;
		}>(),
		{
			loading: false,
			skeletonCount: 4,
		},
	);
</script>
