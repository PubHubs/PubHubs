<template>
	<input
		type="checkbox"
		class="h-6 w-6 mt-1 rounded-md text-green bg-transparent border-1 border-black dark:border-white focus:outline-0 focus:outline-offset-0 focus:ring-0 focus:ring-offset-0 focus:ring-offset-width-0 focus:shadow-0"
		:value="modelValue"
		:checked="modelValue"
		@input="update($event.target.checked)"
		@keydown.esc="cancel()"
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
			type: Boolean,
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, cancel } = useFormInputEvents(emit, props.modelValue);
</script>
