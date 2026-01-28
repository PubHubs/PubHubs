<template>
	<div class="gap-075 mb-2 flex w-4000 flex-col items-start justify-start" v-click-outside="close">
		<Label :for="id" :required="required"><slot></slot></Label>

		<div class="bg-surface-low outline-offset-thin flex w-full items-center justify-start rounded px-175 py-100 outline focus:ring-3" v-click-outside="close">
			<div class="max-h-300 grow cursor-pointer overflow-hidden text-nowrap" @click.stop="toggle">
				<template v-if="model">
					<div v-if="multiple" class="flex items-center gap-100">
						<div v-for="(item, index) in model" class="bg-surface-subtle py-025 rounded px-100">
							<DropDownValue :value="item"></DropDownValue>
						</div>
					</div>
					<DropDownValue v-else :value="model"></DropDownValue>
				</template>
				<span v-else class="text-surface-subtle">{{ placeholder }}</span>
			</div>
			<div class="cursor-pointer rounded-md bg-transparent" @click.stop="toggle">
				<Icon type="caret-down" size="md" weight="fill"></Icon>
			</div>
		</div>

		<div v-if="open" class="bg-surface-low outline-offset-thin flex grow flex-col overflow-hidden rounded outline">
			<DropDownOption v-for="(option, index) in options" :value="option" :active="selection.includes(index)" @click.stop="select(index)" class="-ml-[1px]"></DropDownOption>
		</div>

		<FieldHelperText v-if="(props.help && !changed) || validated">{{ help }}</FieldHelperText>

		<FieldValidationError v-else-if="!validated && changed">
			{{ $t(validateField!.translationKey, validateField!.parameters) }}
		</FieldValidationError>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { PropType, computed, inject, onMounted, ref } from 'vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import DropDownOption from '@hub-client/new-design/components/forms/DropDownOption.vue';
	import DropDownValue from '@hub-client/new-design/components/forms/DropDownValue.vue';
	import FieldHelperText from '@hub-client/new-design/components/forms/FieldHelperText.vue';
	import FieldValidationError from '@hub-client/new-design/components/forms/FieldValidationError.vue';
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	// Composables
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	const props = withDefaults(
		defineProps<{
			options: PropType<any>;
			multiple?: boolean;
			name?: string;
			id?: string;
			placeholder?: string;
			help?: string;
			validation?: Object;
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

	const model = defineModel<any | Array<any>>();
	const selection = ref<Array<number>>([]); // selection of choosen indexes

	// Validation etc.
	const { id, fieldName, update, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(fieldName.value, model, props.validation);

	onMounted(() => {
		// Add field for form validation
		if (props.validation) {
			const addField = inject('addField') as Function;
			if (typeof addField === 'function') {
				addField(fieldName.value, model, changed, validated);
			}
		}
	});

	const open = ref(false);

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

		// sort selection
		selection.value = selection.value.sort();

		// update model
		if (props.multiple) {
			model.value = [];
			for (let i = 0; i < selection.value.length; i++) {
				model.value.push((props.options as Array<any>)[selection.value[i]]);
			}
			if (model.value.length == 0) {
				model.value = undefined;
			}
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

	const label = computed(() => {
		if (model.value.label) return model.value.label;
		return model.value;
	});

	const icon = computed(() => {
		if (model.value.icon) return model.value.icon;
		return undefined;
	});

	const toggle = () => {
		open.value = !open.value;
	};

	const close = () => {
		open.value = false;
	};
</script>
