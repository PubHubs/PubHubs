<template>
	<button
		:aria-disabled="disabled ? 'true' : undefined"
		:aria-label="label"
		:class="buttonClass"
		:disabled="disabled"
		:title="title ?? label"
		class="rounded-base focus:outline-accent-primary fixed right-4 bottom-4 z-50 flex h-12 w-12 cursor-pointer items-center justify-center font-medium shadow-lg transition-all duration-150 ease-in-out hover:opacity-75 focus:outline-3 active:scale-95 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
		type="button"
		@click="handleClick"
	>
		<Icon
			:type="icon"
			size="sm"
		/>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			label: string;
			color?: string;
			disabled?: boolean;
			icon?: string;
			title?: string;
		}>(),
		{
			color: 'primary',
			disabled: false,
			icon: 'add',
			title: undefined,
		},
	);

	const emit = defineEmits<{
		(e: 'click', evt: MouseEvent): void;
	}>();

	const colorClass: Record<string, string> = {
		primary: 'bg-accent-primary text-on-accent-primary',
	};

	const buttonClass = computed(() => colorClass[props.color] ?? colorClass['blue']);

	function handleClick(evt: MouseEvent) {
		if (props.disabled) {
			evt.preventDefault();
			evt.stopPropagation();
			return;
		}
		emit('click', evt);
	}
</script>
