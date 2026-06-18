<template>
	<ValidateField
		v-slot="{ id: fieldId, validated, required, changed }"
		v-model="model"
		class="form-textfield gap-075 flex w-full flex-col items-start justify-start"
		:help="help"
		:info="lenText"
		:name="fieldName"
		:validation="validation"
	>
		<Label :for="fieldId"><slot /></Label>

		<!-- Input element -->
		<div class="flex w-full items-center">
			<div
				class="relative grow"
				:class="{ 'w-full': !showLength }"
			>
				<Icon
					v-if="icon"
					class="text-on-surface-dim absolute top-1/2 left-100 -translate-y-1/2"
					size="sm"
					:type="icon"
				/>
				<Icon
					v-if="rightIcon"
					class="text-on-surface-dim absolute top-1/2 right-100 -translate-y-1/2"
					:class="rightIconClass"
					size="sm"
					:type="rightIcon"
					@click="$emit('rightIconClick')"
				/>
				<textarea
					v-if="type === 'textarea'"
					:id="fieldId"
					v-model="model"
					:aria-invalid="!validated && changed ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					class="bg-surface outline-offset-thin disabled:bg-surface-base! w-full justify-start rounded px-175 py-100 outline-2 focus:outline-3"
					:class="[
						!validated && changed
							? 'outline-accent-error focus:outline-on-accent-error'
							: 'outline-on-surface-dim focus:outline-accent-blue-interactive',
						icon ? 'pl-600!' : '',
						rightIcon ? 'pr-600!' : '',
					]"
					:disabled="disabled"
					:name="fieldName"
					:placeholder="placeholder"
					@input="update()"
				/>
				<input
					v-else
					:id="fieldId"
					v-model="model"
					:aria-invalid="!validated && changed ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					class="bg-surface-base outline-offset-thin disabled:bg-surface-base! w-full justify-start rounded px-175 py-100 outline-2 focus:outline-3"
					:class="[
						!validated && changed
							? 'outline-accent-error focus:outline-on-accent-error'
							: 'outline-on-surface-dim focus:outline-accent-blue-interactive',
						icon ? 'pl-600!' : '',
						rightIcon ? 'pr-600!' : '',
					]"
					:disabled="disabled"
					:name="fieldName"
					:placeholder="placeholder"
					:type="type"
					@input="update()"
				/>
			</div>
		</div>
	</ValidateField>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, onMounted, ref, useAttrs, watch } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import Label from '@hub-client/components/forms/elements/Label.vue';
	import ValidateField from '@hub-client/components/forms/elements/ValidateField.vue';

	// Composables
	import { useFormInput } from '@hub-client/composables/FormInput.composable';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type FieldValidations } from '@hub-client/models/validation/TValidate';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			icon?: string;
			id?: string;
			name?: string;
			placeholder?: string;
			rightIcon?: string;
			rightIconClass?: string;
			showLength?: boolean;
			type?: string;
			validation?: FieldValidations;
		}>(),
		{
			disabled: false,
			help: '',
			icon: undefined,
			id: undefined,
			name: undefined,
			placeholder: '',
			rightIcon: undefined,
			rightIconClass: '',
			showLength: false,
			type: 'text',
			validation: undefined,
		},
	);

	defineEmits<{
		rightIconClick: [];
	}>();

	const attrs = useAttrs();
	const model = defineModel<string | number>();
	const modelLen = ref(0);

	const logger = createLogger('TextField');
	const { slotDefault, fieldName, update } = useFormInput(props, model);

	// Computed
	const maxLen = computed(() => {
		if (!props.validation) return false;
		if (!props.validation.maxLength) return false;
		return props.validation.maxLength;
	});

	const calculateLen = () => {
		if (typeof model.value === 'string') {
			modelLen.value = model.value.length;
		} else if (typeof model.value === 'number') {
			modelLen.value = model.value.toFixed().length;
		} else {
			modelLen.value = 0;
		}
	};

	const lenText = computed(() => {
		if (maxLen.value === false) return false;
		return modelLen.value + ' / ' + maxLen.value;
	});

	// Lifecycle
	watch(model, () => {
		calculateLen();
	});

	onMounted(() => {
		if (import.meta.env.DEV) {
			const hasVisibleLabel = !!slotDefault.value || !!props.name;
			const hasAriaLabel = !!(attrs as Record<string, unknown>)['aria-label'];
			if (!hasVisibleLabel && !hasAriaLabel) {
				logger.warn('[TextField] Accessible name missing. Provide either a visible label (slot / name prop) or `aria-label` attribute.');
			}
		}
		calculateLen();
	});
</script>
