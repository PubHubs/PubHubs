<template>
	<input type="checkbox" class="focus:outline-0 focus:outline-offset-0 focus:ring-0 focus:ring-offset-0 focus:ring-offset-width-0 focus:shadow-0" v-model="value" @keydown="changed()" @keydown.enter="submit()" @keydown.esc="cancel()" />
	<label class="ml-2 dark:text-white">{{ label }}</label>
</template>

<script setup lang="ts">
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

	defineProps({
		label: {
			type: String,
			required: true,
		},
	});

	const emit = defineEmits(usedEvents);
	const { value, changed, submit, cancel } = useFormInputEvents(emit);
</script>
