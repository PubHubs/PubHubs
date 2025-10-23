<template>
	<hr v-tw-class="size + ' mt-2 mb-4 text-gray theme-light:text-gray dark:text-white theme-dark:text-white'" />
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	type Props = {
		direction?: 'Vertical' | 'Horizontal';
		thickness?: string; // Given as a tailwind size (e.g., h-thickness).
	};

	const props = withDefaults(defineProps<Props>(), {
		direction: 'Horizontal',
		thickness: '1',
	});

	const size = computed(() => {
		switch (props.direction) {
			case 'Horizontal':
				return `h-${props.thickness}`;

			case 'Vertical':
			default:
				return `w-${props.thickness}`;
		}
	});
</script>
