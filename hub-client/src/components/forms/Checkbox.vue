<template>
	<input
		type="checkbox"
		class="border-1 focus:ring-offset-width-0 focus:shadow-0 mt-1 h-6 w-6 rounded-md bg-transparent focus:outline-0 focus:outline-offset-0 focus:ring-0 focus:ring-offset-0"
		:class="colorClass"
		:value="modelValue"
		:checked="modelValue"
		:disabled="props.disabled"
		@input="update(($event.target as HTMLInputElement).checked)"
		@keydown.esc="cancel()"
	/>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { computed } from 'vue';

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		color: {
			type: String,
			default: 'green',
		},
		modelValue: {
			type: Boolean,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, cancel } = useFormInputEvents(emit, props.modelValue);

	const colors: { [key: string]: string } = {
		green: 'text-green',
		blue: 'text-blue',
	};

	const colorClass = computed(() => {
		return colors[props.color];
	});
</script>
