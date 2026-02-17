<template>
	<ValidateField
		v-model="model"
		:name="fieldName"
		:validation="validation"
		:help="help"
		v-slot="{ id, validated, required }"
		v-click-outside="close"
		class="gap-050 relative mb-2 flex w-full min-w-4000 flex-col items-start justify-start"
		@keydown.arrow-down.prevent="cursorDown()"
		@keydown.arrow-up.prevent="cursorUp()"
		@keydown.enter.prevent="select(cursor)"
		@keydown.esc.prevent="close"
	>
		<Label :for="id" :required="required"><slot></slot></Label>

		<div :id="id" class="bg-surface-low outline-offset-thin flex w-full items-center justify-start rounded px-175 py-100 outline focus:ring-3" role="combobox" tabindex="0">
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

		<div v-show="open" class="bg-surface-low outline-offset-thin absolute top-800 z-50 flex w-full grow flex-col rounded outline">
			<DropDownOption v-for="(option, index) in options" :value="option" :highlighted="cursor === index" :active="selection.includes(index)" @click.stop="select(index)" class="-ml-[1px]"></DropDownOption>
		</div>
	</ValidateField>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';

	// Composables
	import { useKeyStrokes } from '@hub-client/composables/useKeyStrokes';

	// Models
	import { FieldInputType, FieldOptions, FieldSelection } from '@hub-client/models/validation/TFormOption';
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// Composables
	import DropDownOption from '@hub-client/new-design/components/forms/DropDownOption.vue';
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			options: FieldOptions;
			multiple?: boolean;
			name?: string;
			id?: string;
			placeholder?: string;
			help?: string;
			validation?: FieldValidations;
			disabled?: boolean;
		}>(),
		{
			multiple: false,
			placeholder: '',
			help: '',
			validation: undefined,
			disabled: false,
		},
	);

	const model = defineModel<FieldInputType>();

	const { setItems, cursor, cursorDown, cursorUp } = useKeyStrokes();
	const { fieldName, update, changed } = useFormInput(props, model);

	const selection = ref<FieldSelection>([]); // Selection of choosen indexes

	onMounted(() => {
		setItems(props.options as Array<any>);
		// Set selection
		if (model.value) {
			if (props.multiple) {
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
