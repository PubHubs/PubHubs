<template>
	<div v-if="count > 0">
		<CollapsibleHeader :label="label">
			<template #right>
				<Pill :value="count" />
			</template>
			<slot />
		</CollapsibleHeader>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Pill from '@hub-client/components/elements/Pill.vue';
	import CollapsibleHeader from '@hub-client/components/ui/CollapsibleHeader.vue';

	defineProps<{
		count: number;
		label: string;
	}>();
</script>
