<template>
	<input
		v-tw-class="'w-full'"
		class="truncate rounded-lg border bg-background px-2 py-1 text-on-surface placeholder:text-on-surface"
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
