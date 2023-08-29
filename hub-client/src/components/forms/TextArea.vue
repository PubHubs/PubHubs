<template>
	<textarea
		v-tw-class="'w-full h-12'"
		class="rounded-lg border py-1 px-2 theme-light:text-black dark:bg-transparent dark:text-white dark:border-white theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		@input="update($event.target.value)"
		@keyup="changed()"
		@keydown.enter="submit()"
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
			type: String,
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);
</script>
