<template>
	<div :class="buttonClass" class="block relative font-semibold rounded-lg text-center transition-all duration-150 ease-in-out shadow-md cursor-pointer" @click="click($event)">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { buttonSizes } from '@/assets/sizes';

	const colorClass: { [key: string]: string } = {
		disabled: 'bg-gray-light text-gray-lighter shadow-none cursor-not-allowed',
		white: 'bg-white hover:bg-blue text-black ',
		gray: 'bg-gray-dark hover:bg-black dark:bg-black hover:dark:bg-gray-dark text-white',
		'gray-light': 'bg-gray-light hover:bg-red text-white ',
		blue: 'bg-blue hover:bg-blue-dark text-white dark:hover:bg-white dark:hover:text-blue-dark',
		green: 'bg-green hover:bg-green-dark text-white',
		red: 'bg-red hover:bg-red-dark text-white',
		redder: 'bg-red-dark hover:bg-red text-white',
		black: 'bg-black hover:bg-gray-dark text-white shadow-md cursor-pointer',
	};

	const props = defineProps({
		color: {
			type: String,
			default: 'blue',
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
