<template>
	<input
		v-tw-class="'w-full'"
		class="bg-background text-on-surface placeholder:text-on-surface truncate rounded-lg border px-2 py-1 break-all"
		data-test="textinput"
		:disabled="props.disabled"
		:maxlength="maxlength"
		:placeholder="placeholder"
		:title="placeholder"
		type="text"
		:value="modelValue"
		@input="update(($event.target as HTMLInputElement).value)"
		@keydown.enter="submit()"
		@keydown.esc="cancel()"
	/>
</template>

<script lang="ts" setup>
	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		modelValue: {
			type: String,
			default: '',
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
