<template>
	<!--
		data-initialized is used by the 26-miniclient-badge e2e test to detect
		when the initial sync is done. Only set when `initialized` is passed
		(MiniclientIndependent sets it after its initial fetch; MiniclientLinked
		does not bother — that test runs the miniclient standalone, so only
		Independent reaches it).
	-->
	<div
		class="flex justify-end"
		:data-initialized="initialized || undefined"
	>
		<Badge
			v-if="unreadState === 'unread'"
			color="ph"
			size="sm"
			data-testid="miniclient-badge"
		/>
		<Badge
			v-if="unreadState === 'unknown'"
			color="unknown"
			size="sm"
			data-testid="miniclient-unknown-badge"
		/>
	</div>
</template>

<script setup lang="ts">
	/**
	 * Presentational component: renders the miniclient's unread-state badge.
	 * Shared by MiniclientIndependent and MiniclientLinked so the markup and
	 * data-testid wiring used by the e2e tests live in exactly one place.
	 */
	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';

	// Models
	import type { UnreadState } from '@hub-client/models/rooms/TBaseRoom';

	defineProps<{
		unreadState: UnreadState;
		initialized?: boolean;
	}>();
</script>
