<template>
	<button
		@click="click($event)"
		class="flex h-300 w-300 items-center justify-center rounded"
		:class="{ 'bg-accent-blue': hasFocus, 'cursor-pointer': !disabled }"
		role="button"
		:disabled="disabled"
		@focusin="if (!disabled) setFocus(true);"
		@focusout="setFocus(false)"
	>
		<Icon :class="iconButtonColors[computedVariant]" :type="type" :size="size" :weight="weight" :mirrored="mirrored" :testid="testid"></Icon>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { PropType, computed } from 'vue';

	import { iconTypes } from '@hub-client/assets/icons';

	import Icon from '@hub-client/new-design/components/Icon.vue';
	import { useFormInput } from '@hub-client/new-design/composables/useFormInput';
	import { iconButtonColors, iconColorVariant, iconSizeVariant } from '@hub-client/new-design/types/component-variants';

	const { setFocus, hasFocus } = useFormInput();

	const props = defineProps({
		type: {
			type: String,
			default: 'selection',
			validator(value: string) {
				return Object.values(iconTypes).includes(value);
			},
		},
		variant: {
			type: String,
			default: iconColorVariant.Primary,
			validator(value: iconColorVariant) {
				return Object.values(iconColorVariant).includes(value);
			},
		},
		size: {
			type: String,
			default: iconSizeVariant.Base,
			validator(value: iconSizeVariant) {
				return Object.values(iconSizeVariant).includes(value);
			},
		},
		weight: {
			type: String as PropType<'default' | 'regular' | 'fill'>,
			default: 'default',
		},
		mirrored: {
			type: Boolean,
			default: false,
		},
		testid: {
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
		if (props.disabled) v = iconColorVariant.Disabled;
		return v;
	});

	const click = (event: Event) => {
		if (props.disabled) {
			event.stopImmediatePropagation();
		}
	};
</script>
