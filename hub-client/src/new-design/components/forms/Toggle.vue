<template>
	<div class="flex items-center justify-start gap-200" :class="disabled ? '' : 'cursor-pointer'" @click="toggle(disabled)">
		<div v-if="!model" class="bg-surface-base outline-surface-on-surface-dim px-050 py-050 outline-offset-thin flex items-center justify-start rounded-[999px] outline" :class="disabled ? 'opacity-50' : ''">
			<div class="bg-on-surface-dim h-150 w-150 rounded-full"></div>
			<div class="h-150 w-150 rounded-full"></div>
		</div>
		<div v-else class="bg-button-on-blue outline-accent-blue px-050 py-050 outline-050 outline-offset-thin inline-flex items-center justify-start rounded-[999px] outline" :class="disabled ? 'opacity-50' : ''">
			<div class="h-150 w-150 rounded-full"></div>
			<div class="bg-accent-blue h-150 w-150 rounded-full"></div>
		</div>

		<input ref="input" type="checkbox" class="sr-only" :disabled="props.disabled" :value="model" />

		<div class="pt-thin">
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
