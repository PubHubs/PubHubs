<template>
	<div class="flex">
		<Button
			v-for="(option, index) in options"
			:key="index"
			:class="roundedClass(index)"
			:color="optionIsSelected(option) ? 'primary' : 'gray'"
			:size="size"
			@click="
				selectOption(option);
				changed();
			"
		>
			{{ option.label }}
		</Button>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { type PropType, watch } from 'vue';

	// Components
	import Button from '@hub-client/components/elements/Button.vue';

	// Composables
	import { type Options, useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const props = defineProps({
		options: {
			type: Array as PropType<Options>,
			required: true,
		},
		value: {
			type: [Number, String, Boolean],
			default: '',
		},
		size: {
			type: String,
			default: 'base',
		},
	});

	const emit = defineEmits(usedEvents);

	watch(
		() => props.value,
		() => {
			setValue(props.value);
		},
	);

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
