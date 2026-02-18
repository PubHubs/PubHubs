<template>
	<div
		@keydown.arrow-down.prevent="cursorDown()"
		@keydown.arrow-up.prevent="cursorUp()"
		@keydown.enter.stop="enter()"
		@keydown.esc.stop="
			reset();
			search = undefined;
		"
		class="relative w-full"
	>
		<TextField v-model="search" :placeholder="placeholder" :disabled="disabled" :validation="validation">{{ label }}</TextField>

		<ul
			v-if="result.length > 0"
			class="text-on-surface-dim bg-surface-base outline-offset-thin -mt-075 outline-on-accent-primary ring-on-accent-primary absolute z-50 w-full justify-start rounded-lg rounded-t-none border border-t-0 px-175 py-100 ring-3 outline"
		>
			<li v-for="(item, index) in result" :key="index" @click="select(item)" class="hover:text-on-surface-bright cursor-pointer">
				{{ item.label }}
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Composables
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	// Models
	import { FieldOption, FieldOptions, InputType, LabeledFieldOptions } from '@hub-client/models/validation/TFormOption';
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			name?: string;
			options: FieldOptions;
			placeholder?: string;
			validation?: FieldValidations;
		}>(),
		{
			disabled: false,
			name: '',
			placeholder: '',
			validation: undefined,
		},
	);

	const search = ref<InputType>();
	const selected = defineModel<InputType>();

	const { slotDefault, update } = useFormInput(props, search);
	const { setItems, cursor, cursorDown, cursorUp, reset, selectItemByEnter } = useKeyStrokes();

	// Computed
	const label = computed(() => {
		return props.name ? props.name : slotDefault.value;
	});

	const placeholder = computed(() => {
		return props.placeholder ? props.placeholder : slotDefault.value;
	});

	const labeledOptions = computed(() => {
		if (typeof props.options[0] === 'object') return props.options as LabeledFieldOptions;
		return props.options.map((item) => {
			return { label: item, value: item } as FieldOption;
		});
	});

	const result = computed(() => {
		if (search.value === '' || search.value === undefined || labeledOptions.value.find((item) => search.value?.toString().toLowerCase() === item?.label.toLowerCase())) {
			setItems([]);
			return [];
		}
		let matches = 0;
		const result = labeledOptions.value.filter((item) => {
			const searchValue = (search.value?.toString() || '').toLowerCase();
			// Make sure that only searched in alphabetical characters, so 'email' will find 'e-mail'.
			const label = item.label.replace(/[^a-zA-Z ]/g, '').toLowerCase();
			if (label.includes(searchValue) && matches < 10 && label.toLowerCase() !== searchValue) {
				matches++;
				return item;
			}
		});
		setItems(result);
		return result;
	});

	const enter = () => {
		const item = selectItemByEnter();
		select(item);
	};

	const select = (item: FieldOption) => {
		selected.value = item;
		if (item.label) {
			search.value = item.label;
		} else {
			search.value = item as unknown as InputType;
		}
		update();
	};

	// Lifecycle
	onMounted(() => {
		search.value = selected.value;
	});
</script>
