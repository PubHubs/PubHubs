<template>
	<input
		v-tw-class="'w-full'"
		class="truncate break-all rounded-lg border bg-background px-2 py-1 text-on-surface placeholder:text-on-surface"
		type="text"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		:disabled="props.disabled"
		:maxlength="maxlength"
		@input="update($event.target.value)"
		@keydown.enter="submit()"
		@keydown.esc="cancel()"
		data-test="textinput"
	/>
</template>

<script setup lang="ts">
	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

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
		maxlength: {
			type: Number,
			default: 1000,
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, submit, cancel } = useFormInputEvents(emit, props.modelValue);
</script>
