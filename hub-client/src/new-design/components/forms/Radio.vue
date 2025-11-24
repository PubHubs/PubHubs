<template>
	<div class="flex items-center justify-start gap-4" @click="toggle()">
		<div v-if="model === value" class="inline-flex h-6 w-6 flex-col items-center justify-center gap-2">
			<div class="bg-button-on-blue outline-accent-blue flex flex-col items-start justify-center rounded-[999px] p-1 outline-1 outline-offset-[-0.50px]">
				<div class="bg-accent-blue h-2 w-2 rounded-full"></div>
			</div>
		</div>
		<div v-else class="inline-flex h-6 w-6 flex-col items-center justify-center gap-2">
			<div class="bg-surface-base border-surface-on-surface-dim h-4 w-4 rounded-[999px] border-[0.50px]"></div>
		</div>

		<input ref="input" type="radio" :id="id" v-model="model" :value="value" class="hidden" @input="update(($event.target as HTMLInputElement).checked)" />

		<div class="inline-flex flex-col items-start justify-center pt-0.5">
			<label :for="id" class="text-surface-on-surface justify-start"><slot></slot></label>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { useTemplateRef } from 'vue';

	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';

	const model = defineModel();
	const input = useTemplateRef('input');

	const { id, toggle, update } = useFormInput(model, input);

	const props = defineProps({
		value: {
			type: String,
			default: '',
		},
	});
</script>
