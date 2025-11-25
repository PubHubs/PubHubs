<template>
	<div class="gap-075 mb-200 flex flex-col items-start justify-start" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div class="text-label-small gap-050 inline-flex items-start justify-start">
			<div class="text-surface-on-surface justify-end"><slot></slot></div>
			<div v-if="validation.required" class="text-accent-red justify-end">*</div>
		</div>
		<div
			class="bg-surface-base outline-surface-on-surface-dim outline-offset-thin min-h-1000 rounded px-175 py-100 outline"
			:class="{ 'ring-button-blue ring-3': hasFocus, 'outline-surface-on-surface-dim': validated, 'outline-accent-error': !validated }"
		>
			<input ref="input" v-model="model" class="text-surface-on-surface-dim justify-start" :placeholder="placeholder" />
		</div>
		<div v-if="error" class="text-accent-red text-label-small gap-050 flex items-center"><Icon type="warning"></Icon>{{ $t(error, [errorParam]) }}</div>
		<div v-if="help" class="text-surface-on-surface-dim text-label-small justify-end">{{ help }}</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { defaultValidation, useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();

	const props = defineProps({
		placeholder: {
			type: String,
			default: '',
		},
		validation: {
			type: Object,
			default: defaultValidation,
		},
		help: {
			type: String,
			default: '',
		},
	});

	const { setFocus, hasFocus, error, errorParam, validated } = useFormInput(model, props.validation);
</script>
