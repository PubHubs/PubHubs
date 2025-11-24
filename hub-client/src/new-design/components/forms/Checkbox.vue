<template>
	<div class="flex cursor-pointer items-center justify-start gap-4" @click="toggle()">
		<div class="inline-flex h-6 w-6 flex-col items-center justify-center gap-2">
			<div v-if="!model" class="bg-surface-base border-on-surface-dim h-4 w-4 rounded border-[0.50px]"></div>
			<div v-else class="bg-button-on-blue outline-accent-on-blue flex h-4 w-4 flex-col items-center justify-center rounded p-0.5 outline-1 outline-offset-[-0.50px]">
				<div class="relative h-3 w-3 overflow-hidden rounded">
					<div class="outline-accent-blue absolute top-[3px] left-[1.50px] h-1.5 w-2.5">
						<svg width="11" height="8" viewBox="0 0 11 8" fill="none" xmlns="http://www.w3.org/2000/svg">
							<path
								d="M9.5 0.25C9.66582 0.25 9.82513 0.316344 9.94238 0.433594C10.0594 0.550767 10.1249 0.709391 10.125 0.875C10.125 1.04082 10.0596 1.20013 9.94238 1.31738L3.94238 7.31738C3.88436 7.37545 3.81509 7.42169 3.73926 7.45312C3.66348 7.48449 3.58201 7.50098 3.5 7.50098C3.41794 7.50095 3.33655 7.48455 3.26074 7.45312C3.18488 7.42167 3.11566 7.37549 3.05762 7.31738V7.31641L0.433594 4.69238C0.316344 4.57513 0.25 4.41582 0.25 4.25C0.250055 4.08426 0.316393 3.92579 0.433594 3.80859C0.550794 3.69139 0.709259 3.62506 0.875 3.625C1.04082 3.625 1.20013 3.69134 1.31738 3.80859L3.5 5.99121L9.05859 0.433594C9.17579 0.316393 9.33426 0.250055 9.5 0.25Z"
								fill="currentColor"
								stroke="currentColor"
								stroke-width="0.5"
							/>
						</svg>
					</div>
				</div>
			</div>
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
