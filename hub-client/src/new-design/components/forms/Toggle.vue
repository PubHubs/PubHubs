<template>
	<div class="flex cursor-pointer items-center justify-start gap-4" @click="toggle()">
		<div v-if="!value" class="bg-surface-base outline-surface-on-surface-dim flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-[0.50px] outline-offset-[-0.50px]">
			<div class="bg-on-surface-dim h-3 w-3 rounded-full"></div>
			<div class="h-3 w-3 rounded-full"></div>
		</div>
		<div v-else class="bg-button-on-blue outline-accent-blue inline-flex items-center justify-start rounded-[999px] px-1 py-[3px] outline-1">
			<div class="h-3 w-3 rounded-full"></div>
			<div class="bg-accent-blue h-3 w-3 rounded-full"></div>
		</div>

		<input ref="input" type="checkbox" class="hidden" :value="modelValue" :checked="modelValue" :disabled="props.disabled" @input="update(($event.target as HTMLInputElement).checked)" @keydown.esc="cancel()" @click="toggle()" />

		<div class="cursor-pointer pt-0.5">
			<label class="text-surface-on-surface cursor-pointer justify-start">{{ label }}</label>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { useTemplateRef } from 'vue';

	// Composables
	import { useFormInputEvents, usedEvents } from '@hub-client/composables/useFormInputEvents';

	const input = useTemplateRef('input');

	const props = defineProps({
		modelValue: {
			type: Boolean,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		label: {
			type: String,
			default: '',
		},
	});

	const emit = defineEmits(usedEvents);
	const { update, cancel, value } = useFormInputEvents(emit, props.modelValue);

	function toggle() {
		console.info('toggle', props.modelValue);
		input.value?.click();
	}
</script>
