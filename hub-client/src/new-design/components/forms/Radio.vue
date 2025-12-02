<template>
	<div class="flex items-center justify-start gap-200" @click="select(value)" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div v-if="model === value" class="inline-flex h-300 w-300 flex-col items-center justify-center gap-100">
			<div class="bg-on-accent-blue outline-accent-blue p-050 outline-offset-050 flex flex-col items-start justify-center rounded-[999px] outline" :class="{ 'ring-accent-blue ring-3': hasFocus }">
				<div class="bg-accent-blue h-100 w-100 rounded-full"></div>
			</div>
		</div>
		<div v-else class="inline-flex h-300 w-300 flex-col items-center justify-center gap-100">
			<div class="bg-surface-base border-surface-on-surface-dim border-thin h-200 w-200 rounded-[999px]" :class="{ 'ring-button-blue ring-3': hasFocus }"></div>
		</div>

		<input ref="input" type="radio" :id="id" class="sr-only" :value="model" />

		<div class="pt-thin inline-flex flex-col items-start justify-center">
			<label :for="id" class="text-surface-on-surface justify-start" @click="select(value)"><slot></slot></label>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();

	const props = defineProps({
		value: {
			type: String,
			default: '',
		},
		name: {
			type: String,
			default: '',
		},
	});

	const { id, setFocus, hasFocus, select } = useFormInput(props, model);
</script>
