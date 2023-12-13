<template>
	<textarea
		ref="textarea"
		rows="1"
		v-tw-class="'p-2'"
		class="w-full resize-none rounded-lg border dark:text-white dark:border-white theme-light:bg-white theme-light:text-gray-dark theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		maxlength="1500"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		@input="update($event.target?.value)"
		@keyup="
			changed();
			calcSize();
			emit('caretPos', getCaretPos());
		"
		@keydown.enter.exact="submit()"
		@keydown.esc="cancel()"
	/>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { getCaretPos as domGetCaretPos } from '@/lib/domUtility';
	import { Ref } from 'vue';

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		modelValue: {
			type: String,
		},
	});

	const emit = defineEmits([...usedEvents, 'caretPos']);
	const { value, update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	const textarea: Ref<null|HTMLTextAreaElement> = ref(null);

	function getCaretPos() {
		if (!textarea.value) return;
		return domGetCaretPos(textarea.value);
	}

	function calcSize() {
		if (textarea.value) {
			const el = textarea.value as HTMLTextAreaElement;
			const numberOfLineBreaks = (value.value.match(/\n/g) || []).length;
			el.rows = numberOfLineBreaks + 1;
		}
	}
</script>
