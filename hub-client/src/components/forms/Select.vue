<template>
	<select
		v-model="inputValue"
		v-tw-class="'w-full'"
		class="w-full border px-2 py-1 rounded-lg dark:bg-transparent theme-light:border-black theme-light:text-black dark:text-white dark:border-white focus:border-black focus:outline-0 focus:outline-offset-0 focus:ring-0"
		:disabled="props.disabled"
		@change="changed()"
		@input="selectOption($event.target)"
		@keydown.enter="submit()"
		@keydown.esc="cancel()"
	>
		<option v-for="option in options" :key="option.value" :value="option.value" :selected="optionIsSelected(option.value)">{{ option.label }}</option>
	</select>
</template>

<script setup lang="ts">
	import { PropType } from 'vue';
	import { Options, useFormInputEvents, usedEvents } from '@/composables/useFormInputEvents';

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
	const { value: inputValue, setValue, setOptions, selectOption, optionIsSelected, changed, submit, cancel } = useFormInputEvents(emit);

	setValue(props.value);
	setOptions(props.options);
</script>
