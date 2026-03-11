<template>
	<ValidateField :help="help" :info="lenText" :name="fieldName" :validation="validation" v-model="model" v-slot="{ id, validated, required }" class="form-textfield gap-075 mb-100 flex w-full flex-col items-start justify-start">
		<Label :for="id"><slot></slot></Label>

		<!-- Input element -->
		<div class="flex w-full items-center">
			<div class="grow" :class="{ 'w-full': !showLength }">
				<textarea
					v-if="type === 'textarea'"
					class="bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
					v-model="model"
					:aria-invalid="!validated ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
					:disabled="disabled"
					:name="name"
					:id="id"
					:placeholder="placeholder"
					@input="update()"
				/>
				<input
					v-else
					class="bg-surface-base outline-offset-thin w-full justify-start rounded px-175 py-100 outline focus:ring-3"
					v-model="model"
					:aria-invalid="!validated ? 'true' : undefined"
					:aria-required="required ? 'true' : undefined"
					:class="!validated ? 'outline-accent-error focus:ring-on-accent-error' : 'outline-on-surface-dim focus:ring-on-accent-primary'"
					:disabled="disabled"
					:name="name"
					:id="id"
					:placeholder="placeholder"
					:type="type"
					@input="update()"
				/>
			</div>
		</div>
	</ValidateField>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, useAttrs, watch } from 'vue';

	// Models
	import { FieldValidations } from '@hub-client/models/validation/TValidate';

	// New design
	import Label from '@hub-client/new-design/components/forms/Label.vue';
	import ValidateField from '@hub-client/new-design/components/forms/ValidateField.vue';
	import { useFormInput } from '@hub-client/new-design/composables/FormInput.composable';

	// Props
	const props = withDefaults(
		defineProps<{
			disabled?: boolean;
			help?: string;
			id?: string;
			name?: string;
			placeholder?: string;
			showLength?: boolean;
			type?: string;
			validation?: FieldValidations;
		}>(),
		{
			disabled: false,
			help: '',
			placeholder: '',
			showLength: false,
			type: 'text',
			validation: undefined,
		},
	);

	const attrs = useAttrs();
	const model = defineModel<string | number>();
	const modelLen = ref(0);

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
		if (process.env.NODE_ENV !== 'production') {
			const hasVisibleLabel = !!slotDefault.value || !!props.name;
			const hasAriaLabel = !!(attrs as any)['aria-label'];
			if (!hasVisibleLabel && !hasAriaLabel) {
				console.warn('[TextField] Accessible name missing. Provide either a visible label (slot / name prop) or `aria-label` attribute.');
			}
		}
		calculateLen();
	});
</script>
