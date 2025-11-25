<template>
	<div class="mb-4 flex flex-col items-start justify-start gap-1.5">
		<div class="text-label-small inline-flex items-start justify-start gap-1">
			<div class="text-surface-on-surface justify-end"><slot></slot></div>
			<div v-if="validation.required" class="text-accent-red justify-end">*</div>
		</div>
		<div class="bg-surface-base rounded outline-[0.50px] outline-offset-[-0.50px]" :class="validated ? 'outline-surface-on-surface-dim' : 'outline-accent-red'">
			<textarea ref="input" class="text-surface-on-surface-dim h-24 min-h-11 w-72 justify-start px-3.5 py-3" :placeholder="placeholder" :title="placeholder" v-model="model"></textarea>
		</div>
		<div v-if="error" class="text-accent-red text-label-small flex items-center gap-1"><Icon type="warning"></Icon>{{ $t(error, [errorParam]) }}</div>
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

	const { error, errorParam, validated } = useFormInput(model, props.validation);
</script>
