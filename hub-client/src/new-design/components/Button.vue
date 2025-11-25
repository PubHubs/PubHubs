<template>
	<div :class="buttonBgColors[computedVariant]" class="gap-050 flex min-h-300 min-w-400 cursor-pointer items-center justify-center rounded px-150 py-100" role="button" @click="click($event)" :disabled="disabled">
		<div v-if="iconLeft" class="h-200 w-200">
			<Icon :type="iconLeft" :size="iconSizeVariant.Small" :class="buttonTextColors[computedVariant]"></Icon>
		</div>
		<div :class="buttonTextColors[computedVariant]" class="justify-start">
			<slot></slot>
		</div>
		<div v-if="iconRight" class="h-200 w-200">
			<Icon :type="iconRight" :size="iconSizeVariant.Small" :class="buttonTextColors[computedVariant]"></Icon>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';

	import Icon from '@hub-client/new-design/components/Icon.vue';
	import { buttonBgColors, buttonColorVariant, buttonTextColors, iconSizeVariant } from '@hub-client/new-design/types/component-variants';

	const props = defineProps({
		variant: {
			type: String,
			default: buttonColorVariant.Primary,
			validator(value: buttonColorVariant) {
				return Object.values(buttonColorVariant).includes(value);
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
		if (props.disabled) v = buttonColorVariant.Disabled;
		return v;
	});

	const click = (event: Event) => {
		if (computedVariant.value === buttonColorVariant.Disabled || props.disabled) {
			event.stopImmediatePropagation();
		}
	};
</script>
