<template>
	<textarea
		ref="elTextarea"
		v-tw-class="'p-100'"
		class="text-body focus:border-on-surface disabled:bg-surface-base! w-full resize-none rounded-lg border focus:ring-0 focus:outline-0 focus:outline-offset-0"
		:disabled="disabled === true"
		:maxlength="maxLength"
		:placeholder="placeholder"
		rows="1"
		:title="placeholder"
		:value="modelValue"
		@input="update(($event.target as HTMLTextAreaElement).value)"
		@keydown="onKeyDown"
		@keydown.esc="cancel()"
		@keyup="onKeyUp"
		@paste="$emit('paste', $event)"
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

	const emit = defineEmits([...usedEvents, 'caretPos', 'paste', 'navigation']);
	const { getCaretPos } = useGetCaretPos();
	const elTextarea: Ref<null | HTMLTextAreaElement> = ref(null);

	type Props = {
		modelValue: string;
		placeholder?: string;
		maxLength?: number;
		disabled?: boolean;
	};
	const { update, changed, cancel } = useFormInputEvents(emit, props.modelValue);

	watch(
		() => props.modelValue,
		() => {
			// make sure the value is actually updated in the update-method for programmatically added values, since they are only automatically updated in the DOM, not for Vue
			update(props.modelValue);
			// Resize when value changes programmatically (e.g., after sending a message)
			nextTick(() => resize());
		},
	);

	const navigationKeys = ['ArrowUp', 'ArrowDown', 'Tab', 'Enter'];

	const onKeyDown = (e: KeyboardEvent) => {
		if (navigationKeys.includes(e.key)) {
			emit('navigation', e);
		}
	};

	const onKeyUp = () => {
		changed();
		emit('caretPos', caretPos());
		resize();
	};

	const caretPos = () => {
		if (!elTextarea.value) return;
		return getCaretPos(elTextarea.value);
	};

	/**
	 * Resizing the textarea accordingly to its content.
	 * The 'auto' height minimizes the textarea before it increases it again.
	 */
	const resize = () => {
		if (!elTextarea.value) return;
		elTextarea.value.style.height = 'auto';
		if (props.modelValue && props.modelValue.length > 0) {
			elTextarea.value.style.height = elTextarea.value.scrollHeight + 'px';
		}
	};
</script>
