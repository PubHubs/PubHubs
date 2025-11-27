<template>
	<div class="flex items-center justify-start gap-200" :class="disabled ? '' : 'cursor-pointer'" @click="toggle(disabled)" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div
			v-if="!model"
			class="bg-surface-base outline-surface-on-surface-dim px-050 py-050 outline-offset-thin flex items-center justify-start rounded-[999px] outline"
			:class="{ 'ring-button-blue ring-3': hasFocus, 'opacity-50': disabled }"
		>
			<div class="bg-on-surface-dim h-150 w-150 rounded-full"></div>
			<div class="h-150 w-150 rounded-full"></div>
		</div>
		<div
			v-else
			class="bg-on-button-blue outline-accent-blue px-050 py-050 outline-050 outline-offset-thin inline-flex items-center justify-start rounded-[999px] outline"
			:class="{ 'ring-button-blue ring-3': hasFocus, 'opacity-50': disabled }"
		>
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

	const props = defineProps({
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const { setFocus, hasFocus, toggle } = useFormInput(props, model);
</script>
