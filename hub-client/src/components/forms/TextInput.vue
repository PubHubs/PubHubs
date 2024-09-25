<template>
	<input
		v-tw-class="'w-full'"
		class="truncate rounded-lg border py-1 px-2 theme-light:text-black dark:bg-transparent dark:text-white dark:border-white theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		type="text"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		:disabled="props.disabled"
		@input="update($event.target.value)"
		@keydown.enter="submit()"
		@keydown.esc="cancel()"
		data-test="textinput"
	/>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		modelValue: {
			type: String,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, submit, cancel } = useFormInputEvents(emit, props.modelValue);
</script>
