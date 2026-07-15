<template>
	<!-- The row is a real box (subgrid) rather than display:contents so link-hint extensions like Vimium
	     can target it: a display:contents element has no client rects, so Vimium skips it entirely.
	     col-span-full + grid-cols-subgrid keep the cells aligned to the parent table's columns.
	     role="button" makes it hint-targetable (a bare Vue @click listener is invisible to Vimium);
	     tabindex + keydown give the same activation to keyboard users. -->
	<div
		class="group col-span-full grid grid-cols-subgrid"
		role="button"
		tabindex="0"
		@click="$emit('click')"
		@keydown.enter.prevent="$emit('click')"
		@keydown.space.prevent="$emit('click')"
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
