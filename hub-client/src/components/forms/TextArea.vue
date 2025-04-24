<template>
	<textarea
		ref="elTextarea"
		v-tw-class="'p-2'"
		rows="1"
		class="w-full resize-none rounded-lg border focus:border-on-surface focus:outline-0 focus:outline-offset-0 focus:ring-0"
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
	import { useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';
	import { useGetCaretPos } from '@/logic/composables/useGetCaretPos';
	import { Ref } from 'vue';

	const { getCaretPos } = useGetCaretPos();
	const elTextarea: Ref<null | HTMLTextAreaElement> = ref(null);

	type Props = {
		modelValue: string;
		placeholder?: string;
		maxLength?: number;
		disabled?: boolean;
	};
	const props = withDefaults(defineProps<Props>(), {
		placeholder: '',
		maxLength: 1500,
		disabled: false,
	});

	const emit = defineEmits([...usedEvents, 'caretPos']);
	const { update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	function onKeyUp() {
		changed();
		emit('caretPos', caretPos());
		resize();
	}

	function caretPos() {
		if (!elTextarea.value) return;
		return getCaretPos(elTextarea.value);
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
