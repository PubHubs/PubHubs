<template>
	<div class="my-100 ml-5">
		<label
			v-tw-class="'text-3xl font-bold text-black dark:text-white break-words'"
			:class="labelClass"
		>
			<slot></slot>
		</label>

		<p
			v-if="$slots.description"
			v-tw-class="'text-2xl text-gray dark:text-gray-light break-words'"
			:class="descriptionClass"
		>
			<slot name="description"></slot>
		</p>
	</div>
</template>

<script setup lang="ts">
	type Props = {
		labelClass?: string;
		descriptionClass?: string;
		lineClass?: string;
		showLine?: boolean;
	};

	withDefaults(defineProps<Props>(), {
		labelClass: '',
		descriptionClass: '',
		lineClass: '',
		showLine: false,
	});
</script>
