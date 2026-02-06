<template>
	<div
		role="button"
		:class="buttonClass"
		class="relative line-clamp-1 block h-fit shrink-0 cursor-pointer rounded-lg text-center font-semibold whitespace-nowrap transition-all duration-150 ease-in-out"
		@click="click($event)"
		:disabled="disabled"
	>
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Assets
	import { buttonSizes } from '@hub-client/assets/sizes';

	const colorClass: { [key: string]: string } = {
		disabled: 'opacity-50 !cursor-not-allowed bg-on-surface-disabled text-on-surface-variant',
		text: 'shadow-none hover:opacity-75',
		primary: 'bg-accent-primary hover:opacity-75 text-on-accent-primary',
		secondary: 'bg-accent-secondary hover:opacity-75 text-on-accent-secondary',
		red: 'bg-button-red hover:opacity-75 text-background dark:text-on-surface',
		gray: 'bg-surface hover:opacity-75 text-on-surface',
	};

	const props = defineProps({
		color: {
			type: String,
			default: 'primary',
		},
		size: {
			type: String,
			default: 'base',
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	});

	const buttonClass = computed(() => {
		let c = buttonSizes[props.size] + ' ';
		if (props.disabled) {
			c += colorClass['disabled'];
		} else {
			c += colorClass[props.color];
		}
		return c;
	});

	function click(event: Event) {
		if (props.disabled) {
			event.stopImmediatePropagation();
		}
	}
</script>
