<template>
	<textarea
		ref="elTextarea"
		v-tw-class="'p-2'"
		rows="1"
		class="text-body focus:border-on-surface w-full resize-none rounded-lg border focus:ring-0 focus:outline-0 focus:outline-offset-0"
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
	// Packages
	import { Ref, ref } from 'vue';

	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';
	import { useGetCaretPos } from '@hub-client/composables/useGetCaretPos';

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
		if (props.modelValue === '') {
			elTextarea.value.style.height = 'auto';
		} else {
			elTextarea.value.style.height = 'auto';
			elTextarea.value.style.height = elTextarea.value.scrollHeight + 'px';
		}
	}
</script>
