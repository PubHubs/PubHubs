<template>
	<textarea
		ref="elTextarea"
		v-tw-class="'p-2'"
		class="text-body focus:border-on-surface w-full resize-none rounded-lg border focus:ring-0 focus:outline-0 focus:outline-offset-0"
		:disabled="disabled === true"
		:maxlength="maxLength"
		:placeholder="placeholder"
		rows="1"
		:title="placeholder"
		:value="modelValue"
		@input="update(($event.target as HTMLTextAreaElement).value)"
		@keydown.enter.exact.prevent="submit()"
		@keydown.esc="cancel()"
		@keyup="onKeyUp"
	/>
</template>

<script lang="ts" setup>
	// Packages
	import { type Ref, nextTick, ref, watch } from 'vue';

	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';
	import { useGetCaretPos } from '@hub-client/composables/useGetCaretPos';

	const props = withDefaults(defineProps<Props>(), {
		placeholder: '',
		maxLength: 1500,
		disabled: false,
	});
	const emit = defineEmits([...usedEvents, 'caretPos']);
	const { getCaretPos } = useGetCaretPos();
	const elTextarea: Ref<null | HTMLTextAreaElement> = ref(null);

	type Props = {
		modelValue: string;
		placeholder?: string;
		maxLength?: number;
		disabled?: boolean;
	};
	const { update, changed, submit, cancel } = useFormInputEvents(emit, props.modelValue);

	watch(
		() => props.modelValue,
		() => {
			// make sure the value is actually updated in the update-method for programmatically added values, since they are only automatically updated in the DOM, not for Vue
			update(props.modelValue);
			// Resize when value changes programmatically (e.g., after sending a message)
			nextTick(() => resize());
		},
	);

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
		if (props.modelValue && props.modelValue.length > 0) {
			elTextarea.value.style.height = elTextarea.value.scrollHeight + 'px';
		}
	}
</script>
