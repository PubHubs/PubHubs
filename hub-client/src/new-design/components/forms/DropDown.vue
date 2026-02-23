<template>
	<ValidateField
		:name="fieldName"
		:validation="validation"
		:help="help"
		class="gap-050 relative mb-2 flex w-full min-w-4000 flex-col items-start justify-start"
		v-slot="{ id }"
		v-click-outside="close"
		v-model="model"
		@keydown.arrow-down.prevent="cursorDown()"
		@keydown.arrow-up.prevent="cursorUp()"
		@keydown.enter.prevent="selectCursor(cursor)"
		@keydown.esc.prevent="close"
	>
		<Label :for="id"><slot></slot></Label>

		<div :id="id" class="bg-surface-low outline-offset-thin flex w-full flex-col rounded outline focus:ring-3" role="combobox" tabindex="0">
			<div v-if="filtered" class="border-b px-175 py-100">
				<input v-model="filter" :placeholder="$t('others.filter_values')" />
			</div>
			<div class="flex w-full items-center justify-start px-175 py-100">
				<div class="max-h-300 min-h-6 grow cursor-pointer overflow-hidden text-nowrap" @click.stop="toggle">
					<template v-if="model">
						<div v-if="multiple" class="gap-050 flex max-h-300 items-center">
							<div v-for="item in model" class="bg-surface-subtle rounded px-100" role="listbox">
								<DropDownValue :value="item" role="option"></DropDownValue>
							</div>
						</div>
						<DropDownValue v-else :value="model"></DropDownValue>
					</template>
					<span v-else class="text-surface-subtle">{{ placeholder }}</span>
				</div>
				<div class="cursor-pointer rounded-md bg-transparent" @click.stop="toggle">
					<Icon type="caret-down" size="md" weight="fill" class="ml-050 -mr-050"></Icon>
				</div>
			</div>
		</div>

		<div v-show="open" class="bg-surface-low outline-offset-thin absolute top-800 z-50 flex w-full grow flex-col rounded outline">
			<DropDownOption v-for="(option, index) in filteredOptions" :value="option.item" :highlighted="cursor === index" :active="selection.includes(option.index)" @click.stop="select(option.index)" class="-ml-[1px]"></DropDownOption>
		</div>
	</ValidateField>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';

	// Composables
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	// Models
	import { FieldInputType, FieldOptions, FieldSelection } from '@hub-client/models/validation/TFormOption';
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import DropDownOption from '@hub-client/new-design/components/forms/DropDownOption.vue';
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			id?: string;
			multiple?: boolean;
			name?: string;
			options: FieldOptions;
			placeholder?: string;
			validation?: FieldValidations;
			filtered?: boolean;
		}>(),
		{
			disabled: false,
			help: '',
			multiple: false,
			placeholder: '',
			validation: undefined,
			filtered: false,
		},
	);

	const model = defineModel<FieldInputType>();

	const { setItems, cursor, cursorDown, cursorUp } = useKeyStrokes();
	const { fieldName, update, changed } = useFormInput(props, model);

	const selection = ref<FieldSelection>([]); // Selection of chosen indexes
	const filter = ref('');

	onMounted(() => {
		setItems(filteredOptions.value as Array<any>);
		// Set selection
		if (model.value) {
			if (props.multiple && typeof model.value === 'object') {
				for (let i = 0; i < model.value.length; i++) {
					const idx = (props.options as Array<any>).findIndex((item) => item == model.value[i]);
					if (idx >= 0) {
						selection.value.push(idx);
					}
				}
			} else {
				const idx = (props.options as Array<any>).findIndex((item) => item == model.value);
				if (idx >= 0) {
					selection.value = (props.options as Array<any>)[idx];
				}
			}
		}
		// Set cursor off until it is used
		cursor.value = -1;
	});

	const open = ref(false);

	// Make sure dropdown is opened when cursorkey is used
	watch(cursor, () => {
		if (cursor.value >= 0) {
			open.value = true;
		}
	});

	const filteredOptions = computed(() => {
		let idx = 0;
		let filtered = props.options.map((item) => {
			const indexed = {
				index: idx,
				item: item,
			};
			idx++;
			return indexed;
		});
		if (filter.value.length > 0) {
			let matches = 0;
			const searchValue = (filter.value?.toString() || '').toLowerCase();
			filtered = filtered.filter((item) => {
				let label = item.item;
				if (item.item.label) {
					label = item.item.label;
				}
				// Make sure that only searched in alphabetical characters, so 'email' will find 'e-mail'.
				label = label
					.toString()
					.replace(/[^a-zA-Z ]/g, '')
					.toLowerCase();
				if (label.includes(searchValue) && matches < 10 && label.toLowerCase() !== searchValue) {
					matches++;
					return item;
				}
			});
			open.value = true;
		}
		setItems(filtered as Array<any>);
		cursor.value = -1;
		return filtered;
	});

	const selectCursor = (cursor: number) => {
		const index = filteredOptions.value[cursor].index;
		select(index);
	};

	const select = (index: number) => {
		if (props.multiple) {
			if (selection.value.includes(index)) {
				const idx = selection.value.findIndex((item: any) => item == index);
				if (idx >= 0) {
					selection.value.splice(idx, 1);
				}
			} else {
				selection.value.push(index);
			}
		} else {
			if (selection.value.includes(index)) {
				selection.value = [];
			} else {
				selection.value = [index];
			}
		}

		// Sort selection
		selection.value = selection.value.sort();

		// Update model
		if (props.multiple) {
			let newModel = [] as Array<any> | undefined;
			for (let i = 0; i < selection.value.length; i++) {
				newModel?.push((props.options as Array<any>)[selection.value[i]]);
			}
			if (newModel?.length == 0) {
				newModel = undefined;
			}
			model.value = newModel;
		} else {
			if (selection.value.length > 0) {
				model.value = (props.options as Array<any>)[selection.value[0]];
			} else {
				model.value = undefined;
			}
		}

		filter.value = '';
		update();
		close();
	};

	const toggle = () => {
		open.value = !open.value;
	};

	const close = () => {
		open.value = false;
	};
</script>
