<template>
	<select
		v-model="inputValue"
		v-tw-class="'w-full'"
		class="w-full rounded-lg border px-2 py-1"
		:disabled="props.disabled"
		@change="changed()"
		@keydown.enter="submit()"
		@keydown.esc="cancel()"
	>
		<option
			v-for="option in options"
			:key="option.value"
			:selected="optionIsSelected(option)"
			:value="option.value"
		>
			{{ option.label }}
		</option>
	</select>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType } from 'vue';

	// Composables
	import { type Options, useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const props = defineProps({
		options: {
			type: Array as PropType<Options>,
			required: true,
		},
		value: {
			type: String,
			default: '',
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const emit = defineEmits(usedEvents);
	const { value: inputValue, setValue, setOptions, selectOption: _selectOption, optionIsSelected, changed, submit, cancel } = useFormInputEvents(emit);

	setValue(props.value);
	setOptions(props.options);
</script>
