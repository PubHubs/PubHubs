<template>
	<div class="flex items-center justify-start gap-4" :class="disabled ? '' : 'cursor-pointer'" @click="toggle(disabled)">
		<div v-if="!model" class="bg-surface-base outline-surface-on-surface-dim flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-[0.50px] outline-offset-[-0.50px]" :class="disabled ? 'opacity-50' : ''">
			<div class="bg-on-surface-dim h-3 w-3 rounded-full"></div>
			<div class="h-3 w-3 rounded-full"></div>
		</div>
		<div v-else class="bg-button-on-blue outline-accent-blue inline-flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-1" :class="disabled ? 'opacity-50' : ''">
			<div class="h-3 w-3 rounded-full"></div>
			<div class="bg-accent-blue h-3 w-3 rounded-full"></div>
		</div>

		<input ref="input" type="checkbox" class="hidden" :disabled="props.disabled" :value="model" />

		<div class="pt-0.5">
			<label class="justify-start" :class="disabled ? 'text-on-surface-disabled' : 'text-surface-on-surface cursor-pointer'"><slot></slot></label>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();

	const { toggle } = useFormInput(model);

	const props = defineProps({
		disabled: {
			type: Boolean,
			default: false,
		},
	});
</script>
