<template>
	<ul
		v-for="option in options"
		:key="option.value"
	>
		<li>
			<input
				v-model="inputValue"
				class="focus:ring-offset-width-0 focus:shadow-0 focus:ring-0 focus:ring-offset-0 focus:outline-0 focus:outline-offset-0"
				type="radio"
				:value="option.value"
				@change="
					selectOption(option);
					changed();
				"
			/>
			<label
				class="ml-2"
				:for="String(option.value)"
				>{{ option.label }}</label
			>
		</li>
	</ul>
</template>

<script lang="ts" setup>
	// Packagges
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
	});

	const emit = defineEmits(usedEvents);
	const { value: inputValue, setValue, setOptions, selectOption, changed } = useFormInputEvents(emit);

	setValue(props.value);
	setOptions(props.options);
</script>

<style scoped>
	[type='radio']:checked {
		background-image: none;
	}
	[type='radio']:focus {
		--tw-ring-offset-width: 0px;
	}
</style>
