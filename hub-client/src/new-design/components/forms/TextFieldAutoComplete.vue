<template>
	<div
		:name="fieldName"
		:validation="validation"
		:help="help"
		class="gap-050 relative mb-2 flex w-full min-w-4000 flex-col items-start justify-start"
		@keydown.arrow-down.prevent="cursorDown()"
		@keydown.arrow-up.prevent="cursorUp()"
		@keydown.enter.stop="enter()"
		@keydown.esc.stop="stop()"
		@focusin="focus(true)"
		@focusout="focus(false, 100)"
	>
		<TextField v-model="search" :placeholder="placeholder" :disabled="disabled" :validation="validation">{{ label }}</TextField>

		<ul
			v-if="result.length > 0 && hasFocus"
			class="text-on-surface-dim bg-surface-base outline-offset-thin outline-on-accent-primary absolute top-800 z-50 w-full justify-start rounded-lg rounded-t-none border border-t-0 px-175 py-100 outline"
		>
			<li v-for="(item, index) in result" :key="index" @click="select(item)" class="hover:text-on-surface-bright cursor-pointer" :class="{ '': cursor === index }">
				<DropDownValue :value="item" role="option"></DropDownValue>
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

	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';
	// New design
	import TextField from '@hub-client/new-design/components/forms/TextField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			name?: string;
			options: FieldOptions;
			placeholder?: string;
			help?: string;
			validation?: FieldValidations;
			disabled?: boolean;
		}>(),
		{
			name: '',
			placeholder: '',
			help: '',
			validation: undefined,
			disabled: false,
		},
	);

	const search = ref<InputType>('');
	const hasFocus = ref(false);
	const selected = defineModel<InputType>();

	const { fieldName, slotDefault, update } = useFormInput(props, search);
	const { setItems, cursor, cursorDown, cursorUp, reset, selectItemByEnter } = useKeyStrokes();

	// Lifecycle
	onMounted(() => {
		if (selected.value) {
			search.value = selected.value;
		}
	});

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

	const focus = (focus: boolean, wait: number = 0) => {
		const doFocus = (focus: boolean) => {
			hasFocus.value = focus;
		};
		if (wait) {
			setTimeout(() => {
				doFocus(focus);
			}, wait);
		} else {
			doFocus(focus);
		}
	};

	const stop = () => {
		reset();
		hasFocus.value = false;
		search.value = '';
	};
</script>
