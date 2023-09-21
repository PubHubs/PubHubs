<template>
	<textarea
		ref="textarea"
		rows="1"
		v-tw-class="'pt-1 px-2 pb-2'"
		class="w-full resize-none rounded-lg border theme-light:text-black dark:bg-gray-dark dark:text-white dark:border-white theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		@input="update($event.target?.value)"
		@keyup="
			changed();
			calcSize();
		"
		@keydown.enter.exact="submit()"
		@keydown.esc="cancel()"
	/>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
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
	const { value, update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	const textarea = ref(null);
	function calcSize() {
		if (textarea.value) {
			const el = textarea.value as HTMLTextAreaElement;
			const numberOfLineBreaks = (value.value.match(/\n/g) || []).length;
			el.rows = numberOfLineBreaks + 1;
		}
	}
</script>
