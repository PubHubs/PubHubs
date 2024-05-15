<template>
	<textarea
		ref="elTextarea"
		rows="1"
		v-tw-class="'p-2'"
		class="w-full resize-none rounded-lg border dark:text-white dark:border-white theme-light:text-gray-dark theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		:maxlength="maxLength"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		@input="update($event.target?.value)"
		@keyup="onKeyUp"
		@keydown.enter.exact="submit()"
		@keydown.esc="cancel()"
	/>
</template>

<script setup lang="ts">
	import { ref } from 'vue';
	import { useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';
	import { getCaretPos as domGetCaretPos } from '@/lib/domUtility';
	import { Ref } from 'vue';

	const MAX_CHARS_PER_LINE = 100;

	const elTextarea: Ref<null | HTMLTextAreaElement> = ref(null);

	type Props = {
		placeholder: string;
		modelValue: string;
		maxLength?: number;
	};
	const props = withDefaults(defineProps<Props>(), { placeholder: '', maxLength: 1500 });

	const emit = defineEmits([...usedEvents, 'caretPos']);
	const { update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	function onKeyUp() {
		changed();
		emit('caretPos', getCaretPos());
		calcSize();
	}

	function getCaretPos() {
		if (!elTextarea.value) return;
		return domGetCaretPos(elTextarea.value);
	}

	/**
	 * Calculates and sets the number of rows (height) of the textarea based on number of characters and newline characters.
	 * Html textarea elements don't automatically resize to fit their content and using other elements might lead to accessibility issues.
	 * todo future: Use the caret position instead of number of characters to resize differently depending on size of the textarea.
	 */
	function calcSize() {
		if (!elTextarea.value) return;
		const text = elTextarea.value.value;

		const numLinesLowerBound = Math.ceil(text.length / MAX_CHARS_PER_LINE);
		const numNewLines = text.split('\n').length;
		elTextarea.value.rows = Math.max(numLinesLowerBound, numNewLines);
	}
</script>
