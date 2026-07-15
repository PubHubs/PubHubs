<template>
	<select
		class="focus:ring-offset-width-0 focus:shadow-0 theme-dark:border-white theme-dark:text-white w-full rounded-2xl border-1 border-black bg-transparent text-black focus:ring-0 focus:ring-offset-0 focus:outline-0 focus:outline-offset-0"
		@change="
			updateSelect($event);
			changed();
		"
	>
		<option
			v-for="option in options"
			:key="option.value"
			:value="option.value"
			:selected="option.value === inputValue"
		>
			{{ option.label }}
		</option>
	</select>
</template>

<script setup lang="ts">
	import { type PropType, onMounted } from 'vue';

	import { type Option, type Options, useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const props = defineProps({
		options: {
			type: Array as PropType<Options>,
			required: true,
		},
		value: {
			type: String,
			default: '',
		},
		onSelect: {
			type: Function,
			default: () => {},
		},
	});

	const emit = defineEmits(usedEvents);
	const { value: inputValue, setValue, setOptions, selectOption, changed } = useFormInputEvents(emit);

	setValue(props.value);
	setOptions(props.options);

	function updateSelect(event: Event) {
		const target = event.target as HTMLSelectElement;
		const selectedOption = props.options.find((option) => String(option.value) === target.value);
		if (selectedOption) {
			selectOption(selectedOption);
		}
		props.onSelect(inputValue.value);
	}

	function selectByValue(value: string | number | boolean | undefined) {
		const selectedOption: Option | undefined = props.options.find((option) => option.value === value);
		if (selectedOption) {
			selectOption(selectedOption);
		}
	}

	onMounted(() => {
		selectByValue(inputValue.value);
		changed();
		props.onSelect(inputValue.value);
	});
</script>

<style scoped>
	select {
		background-image: none;
	}
	select:focus {
		--tw-ring-offset-width: 0px;
	}
</style>
