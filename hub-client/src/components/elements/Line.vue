<template>
	<hr v-tw-class="`${size} border-0 bg-gray theme-light:bg-gray dark:bg-white theme-dark:bg-white`" />
</template>

<script setup lang="ts">
import { computed } from 'vue';


type Props = {
	direction: 'Vertical' | 'Horizontal';
	// Given as a tailwind size (For example, h-thickness).
	thickness: string;
}

const props = withDefaults(defineProps<Props>(), {
	direction: 'Horizontal',
	thickness: 'px',
})

const size = computed(() => {
	switch (props.direction) {
		case 'Horizontal':
			return `h-${props.thickness}`;

		case 'Vertical':
		default:
			return `w-${props.thickness}`;
	}
})
</script>
