<template>
	<div class="gap-075 mb-200 flex flex-col items-start justify-start" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div class="text-label-small gap-050 inline-flex items-start justify-start">
			<div class="text-surface-on-surface justify-end"><slot></slot></div>
			<div v-if="validation.required" class="text-accent-red justify-end">*</div>
		</div>
		<div
			class="bg-surface-base outline-surface-on-surface-dim outline-offset-thin rounded px-175 py-100 outline"
			:class="{ 'ring-button-blue ring-3': hasFocus, 'outline-surface-on-surface-dim': validated, 'outline-accent-error': !validated }"
		>
			<input ref="input" v-model="model" class="text-surface-on-surface-dim justify-start" :placeholder="placeholder" />
		</div>
		<div v-if="validateField" class="text-accent-red text-label-small gap-050 flex items-center"><Icon type="warning"></Icon>{{ $t(validateField.translationKey, [validateField.parameters]) }}</div>
		<div v-if="help" class="text-surface-on-surface-dim text-label-small justify-end">{{ help }}</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		validation: {
			type: Object,
			default: {},
		},
		help: {
			type: String,
			default: '',
		},
	});

	const { setFocus, hasFocus } = useFormInput(model);
	const { validateField, validated } = useFieldValidation(model, props.validation);
</script>
