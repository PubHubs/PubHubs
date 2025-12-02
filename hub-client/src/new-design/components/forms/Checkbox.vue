<template>
	<div class="flex items-center justify-start gap-200" :class="disabled ? '' : 'cursor-pointer'" @click="toggle(disabled)" @focusin="setFocus(true)" @focusout="setFocus(false)">
		<div class="inline-flex h-300 w-300 flex-col items-center justify-center gap-100">
			<div v-if="!model" class="bg-surface-base border-on-surface-dim border-thin h-200 w-200 rounded" :class="{ 'ring-button-blue ring-3': hasFocus, 'opacity-50': disabled }"></div>
			<div
				v-else
				class="bg-on-accent-blue outline-accent-on-blue p-thin outline-offset-thin flex h-200 w-200 flex-col items-center justify-center rounded outline"
				:class="{ 'ring-button-blue ring-3': hasFocus, 'opacity-50': disabled }"
			>
				<div class="relative h-150 w-150 overflow-hidden rounded">
					<div class="outline-accent-blue h-075 top-025 left-025 absolute w-125">
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
