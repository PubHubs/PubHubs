<template>
	<input
		v-tw-class="'w-full'"
		class="theme-light:border-black theme-light:text-black truncate rounded-lg border px-2 py-1 focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0 dark:border-white dark:bg-transparent dark:text-white"
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
	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';

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
