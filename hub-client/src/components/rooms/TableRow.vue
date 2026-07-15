<template>
	<div
		class="group contents"
		@click="$emit('click')"
	>
		<slot />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, provide } from 'vue';

	// Props
	const props = defineProps<{
		odd?: boolean;
		selected?: boolean;
	}>();

	defineEmits<{
		click: [];
	}>();

	provide(
		'odd',
		computed(() => props.odd),
	);
	provide(
		'selected',
		computed(() => props.selected),
	);
</script>
