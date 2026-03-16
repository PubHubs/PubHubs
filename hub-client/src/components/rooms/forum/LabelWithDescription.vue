<template>
	<div>
		<label :class="labelClass" v-tw-class="'text-3xl font-bold text-black dark:text-white break-words'">
			<slot></slot>
		</label>

		<Line v-if="showLine" :class="lineClass"></Line>

		<p v-if="$slots.description" :class="descriptionClass" v-tw-class="'text-2xl text-gray dark:text-gray-light break-words'">
			<slot name="description"></slot>
		</p>
	</div>
</template>

<script setup lang="ts">
	import Line from '@/components/elements/Line.vue';

	type Props = {
		labelClass?: string;
		descriptionClass?: string;
		lineClass?: string;
		showLine?: boolean;
	};

	const props = withDefaults(defineProps<Props>(), {
		labelClass: '',
		descriptionClass: '',
		lineClass: '',
		showLine: false,
	});
</script>
