<template>
	<div class="flex cursor-pointer items-center justify-start gap-4" @click="toggle()">
		<div v-if="!model" class="bg-surface-base outline-surface-on-surface-dim flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-[0.50px] outline-offset-[-0.50px]">
			<div class="bg-on-surface-dim h-3 w-3 rounded-full"></div>
			<div class="h-3 w-3 rounded-full"></div>
		</div>
		<div v-else class="bg-button-on-blue outline-accent-blue inline-flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-1">
			<div class="h-3 w-3 rounded-full"></div>
			<div class="bg-accent-blue h-3 w-3 rounded-full"></div>
		</div>

		<input ref="input" type="checkbox" class="hidden" :disabled="props.disabled" @input="update(($event.target as HTMLInputElement).checked)" />

		<div class="cursor-pointer pt-0.5">
			<label class="text-surface-on-surface cursor-pointer justify-start"><slot></slot></label>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { useTemplateRef } from 'vue';

	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();
	const input = useTemplateRef('input');

	const { toggle, update } = useFormInput(model, input);

	const props = defineProps({
		disabled: {
			type: Boolean,
			default: false,
		},
	});
</script>
