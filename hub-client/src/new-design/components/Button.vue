<template>
	<div :class="buttonBgColors[computedVariant]" class="min-h-11 px-3.5 flex min-w-8 items-center justify-center gap-1 rounded py-2" role="button" @click="click($event)" :disabled="disabled">
		<div v-if="iconLeft" class="h-4 w-4">
			<Icon :type="iconLeft"></Icon>
		</div>
		<div :class="buttonTextColors[computedVariant]" class="justify-start">
			<slot></slot>
		</div>
		<div v-if="iconRight" class="h-4 w-4">
			<Icon :type="iconRight"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import { buttonBgColors, buttonTextColors, colorVariant } from '@hub-client/new-design/types/component-variants';

	const props = defineProps({
		variant: {
			type: String,
			default: colorVariant.Primary,
			validator(value: colorVariant) {
				return Object.values(colorVariant).includes(value);
			},
		},
		iconLeft: {
			type: String,
			default: '',
		},
		iconRight: {
			type: String,
			default: '',
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const computedVariant = computed(() => {
		let v = props.variant;
		if (props.disabled) v = colorVariant.Disabled;
		return v;
	});

	const click = (event: Event) => {
		if (computedVariant.value === colorVariant.Disabled) {
			event.stopImmediatePropagation();
		}
	};
</script>
