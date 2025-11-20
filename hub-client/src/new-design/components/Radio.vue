<template>
	<ul v-for="option in options" :key="option.value" role="radiogroup" class="flex flex-col gap-2">
		<li class="inline-flex items-start items-center justify-start gap-4" @click="click(option.value)">
			<div v-if="inputValue === option.value" class="inline-flex h-6 w-6 flex-col items-center justify-center gap-2">
				<div class="bg-accent-on-blue flex flex-col items-start justify-center rounded-[999px] p-1 outline outline-1 outline-offset-[-0.50px] outline-accent-blue">
					<div class="h-2 w-2 rounded-full bg-accent-blue"></div>
				</div>
			</div>
			<div v-else class="inline-flex h-6 w-6 flex-col items-center justify-center gap-2">
				<div class="bg-surface-base border-surface-on-surface-dim h-4 w-4 rounded-[999px] border-[0.50px]"></div>
			</div>

			<input
				type="radio"
				v-model="inputValue"
				:value="option.value"
				class="hidden"
				@change="
					selectOption(option);
					changed();
				"
			/>
			<div class="inline-flex flex-col items-start justify-center pt-0.5">
				<label class="text-surface-on-surface justify-start" :for="option.value">{{ option.label }}</label>
			</div>
		</li>
	</ul>
</template>

<script setup lang="ts">
	// Packages
	import { PropType } from 'vue';

	// Composables
	import { InputType, Options, useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

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

	const click = (value: InputType) => {
		if (inputValue.value === value) {
			setValue('');
		} else {
			setValue(value);
		}
	};
</script>
