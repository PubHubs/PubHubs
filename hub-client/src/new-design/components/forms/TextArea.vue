<template>
	<div class="gap-075 mb-100 flex flex-col items-start justify-start" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div class="text-label-small gap-050 inline-flex items-start justify-start">
			<div class="text-surface-on-surface justify-end"><slot></slot></div>
			<div v-if="required" class="text-accent-red justify-end">*</div>
		</div>
		<div class="bg-surface-base outline-offset-thin rounded outline" :class="{ 'ring-button-blue ring-3': hasFocus, 'outline-surface-on-surface-dim': validated, 'outline-accent-error': !validated }">
			<textarea
				ref="input"
				class="text-surface-on-surface-dim min-h-550 w-full justify-start px-175 py-150"
				:placeholder="placeholder"
				:title="placeholder"
				v-model="model"
				@keypress="update()"
				@focusin="setFocus(true)"
				@focusout="setFocus(false)"
			></textarea>
		</div>
		<div v-if="!validated" class="text-accent-red text-label-small gap-050 flex items-center"><Icon type="warning"></Icon>{{ $t(validateField.translationKey, validateField.parameters) }}</div>
		<div v-if="help" class="text-surface-on-surface-dim text-label-small justify-end">{{ help }}</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { inject, onMounted } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useFieldValidation } from '@hub-client/composables/useValidation';

	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const addField = inject('addField') as Function;
	const model = defineModel();
	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		name: {
			type: String,
			default: '',
		},
		validation: {
			type: Object,
			default: undefined,
		},
		help: {
			type: String,
			default: '',
		},
	});

	const { fieldName, setFocus, hasFocus, update, changed } = useFormInput(props, model);
	const { validateField, validated, required } = useFieldValidation(fieldName.value, model, props.validation);

	onMounted(() => {
		if (typeof addField === 'function' && props.validation) {
			addField(fieldName.value, model, changed, validated);
		}
	});
</script>
