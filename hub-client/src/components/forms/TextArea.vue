<template>
	<textarea
		ref="elTextarea"
		v-tw-class="'p-2'"
		rows="1"
		class="w-full resize-none rounded-lg border dark:text-white dark:border-white theme-light:text-gray-dark theme-light:border-black focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		:maxlength="maxLength"
		:placeholder="placeholder"
		:title="placeholder"
		:value="modelValue"
		:disabled="disabled === true"
		@input="update(($event.target as HTMLTextAreaElement).value)"
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

	const elTextarea: Ref<null | HTMLTextAreaElement> = ref(null);

	type Props = {
		modelValue: string;
		placeholder?: string;
		maxLength?: number;
		disabled?: boolean;
	};
	const props = withDefaults(defineProps<Props>(), { placeholder: '', maxLength: 1500, disabled: false });

	const emit = defineEmits([...usedEvents, 'caretPos']);
	const { update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	function onKeyUp() {
		changed();
		emit('caretPos', getCaretPos());
		resize();
	}

	function getCaretPos() {
		if (!elTextarea.value) return;
		return domGetCaretPos(elTextarea.value);
	}

	/**
	 * Resizing the textarea accordingly to its content.
	 * The 'auto' height minimizes the textarea before it increases it again.
	 */
	function resize() {
		if (!elTextarea.value) return;
		elTextarea.value.style.height = 'auto';
		elTextarea.value.style.height = elTextarea.value.scrollHeight + 'px';
	}
</script>
