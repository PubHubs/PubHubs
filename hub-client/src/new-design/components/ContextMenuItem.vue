<template>
	<button
		class="hover:bg-surface-base first-of-type:rounded-t-base last-of-type:rounded-b-base flex w-full flex-row gap-150 px-175 py-100 not-focus:pl-[18px] first-of-type:pt-150 last-of-type:pb-150 hover:cursor-pointer focus:border-l-4 disabled:cursor-not-allowed"
		role="menuitem"
		type="button"
		v-bind="attrs"
		:aria-disabled="props.disabled ? 'true' : undefined"
		:aria-label="computedAriaLabel"
		:class="disabled ? 'text-on-surface-dim' : isDelicate ? 'text-button-red' : 'text-on-surface'"
		:disabled="disabled"
		:title="computedTitle"
		@click="handleClick"
	>
		<Icon v-if="icon" :type="icon" />
		{{ label }}
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed, useAttrs } from 'vue';

	// New design
	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Types
	export type ContextMenuItemProps = {
		ariaLabel?: string;
		disabled?: boolean;
		icon?: string;
		isDelicate?: boolean;
		label: string;
		title?: string;
	};

	const attrs = useAttrs();

	const props = withDefaults(defineProps<ContextMenuItemProps>(), {
		disabled: false,
		isDelicate: false,
	});

	const { ariaLabel, disabled, icon, isDelicate, label, title } = props;

	// Computed props
	const computedAriaLabel = computed(() => {
		if (label) return label;
		if (title) return title;
		return ariaLabel ?? undefined;
	});

	const computedTitle = computed(() => {
		if (title) return title;
		if (label) return label;
		return undefined;
	});

	//  Lifecycle
	const emit = defineEmits<{
		(e: 'click', evt: MouseEvent): void;
	}>();

	const handleClick = (evt: MouseEvent) => {
		emit('click', evt);
	};
</script>
