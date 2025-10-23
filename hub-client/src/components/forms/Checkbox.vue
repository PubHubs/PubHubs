<template>
	<div class="flex">
		<input
			ref="input"
			type="checkbox"
			class="border-1 focus:ring-offset-width-0 focus:shadow-0 mt-1 h-6 w-6 rounded-md bg-transparent ring-accent-primary checked:!bg-accent-primary hover:cursor-pointer hover:ring-2 focus:outline-0 focus:outline-offset-0 focus:ring-0 focus:ring-offset-0"
			:class="colorClass"
			:value="modelValue"
			:checked="modelValue"
			:disabled="props.disabled"
			@input="update(($event.target as HTMLInputElement).checked)"
			@keydown.esc="cancel()"
		/>
		<label v-if="label !== ''" class="ml-1 mt-1 ~text-label-min/label-max hover:cursor-pointer" @click="toggle()">{{ label }}</label>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, useTemplateRef } from 'vue';

	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const input = useTemplateRef('input');

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		color: {
			type: String,
			default: 'blue',
		},
		modelValue: {
			type: Boolean,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		label: {
			type: String,
			default: '',
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, cancel, value } = useFormInputEvents(emit, props.modelValue);

	const colors: { [key: string]: string } = {
		green: 'accent-accent-secondary',
		blue: 'accent-accent-primary',
	};

	const colorClass = computed(() => {
		return colors[props.color];
	});

	function toggle() {
		input.value?.click();
	}
</script>
