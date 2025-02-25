<template>
	<div class="flex">
		<Button
			v-for="(option, index) in options"
			:key="index"
			:color="optionIsSelected(option) ? 'blue' : 'gray-light'"
			:size="size"
			:class="roundedClass(index)"
			@click="
				selectOption(option);
				changed();
			"
			>{{ option.label }}</Button
		>
	</div>
</template>

<script setup lang="ts">
	// Components
	import Button from '../elements/Button.vue';

	import { PropType } from 'vue';
	import { Options, useFormInputEvents, usedEvents } from '@/logic/composables/useFormInputEvents';

	const props = defineProps({
		options: {
			type: Array as PropType<Options>,
			required: true,
		},
		value: {
			type: [Number, String],
			default: '',
		},
		size: {
			type: String,
			default: 'base',
		},
	});

	const emit = defineEmits(usedEvents);
	const { setValue, setOptions, selectOption, optionIsSelected, changed } = useFormInputEvents(emit);

	setValue(props.value);
	setOptions(props.options);

	function roundedClass(index: number) {
		if (index === 0) {
			return 'rounded-r-none';
		}
		if (index > 0 && index < props.options.length - 1) {
			return 'rounded-l-none rounded-r-none';
		}
		if (index === props.options.length - 1) {
			return 'rounded-l-none';
		}
		return '';
	}
</script>
