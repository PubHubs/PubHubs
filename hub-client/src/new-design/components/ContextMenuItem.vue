<template>
	<button
		class="hover:bg-surface-base first-of-type:rounded-t-base last-of-type:rounded-b-base flex w-full flex-row gap-150 px-175 py-100 not-focus:pl-[17.5px] first-of-type:pt-150 last-of-type:pb-150 hover:cursor-pointer focus:border-l-4 disabled:cursor-not-allowed"
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
		<Icon v-if="icon" :type="icon" class="shrink-0" />
		<span class="truncate">{{ label }}</span>
	</button>
</template>

<script lang="ts">
	// Types
	export type ContextMenuItemProps = {
		ariaLabel?: string;
		disabled?: boolean;
		icon?: string;
		isDelicate?: boolean;
		label: string;
		title?: string;
	};
</script>

<script setup lang="ts">
	// Packages
	import { computed, useAttrs } from 'vue';

	// New design
	import Icon from '@hub-client/new-design/components/Icon.vue';

	// Props
	const props = withDefaults(defineProps<ContextMenuItemProps>(), {
		disabled: false,
		isDelicate: false,
	});

	const attrs = useAttrs();

	// Computed
	const computedAriaLabel = computed(() => {
		if (props.label) return props.label;
		if (props.title) return props.title;
		return props.ariaLabel ?? undefined;
	});

	const computedTitle = computed(() => {
		if (props.title) return props.title;
		if (props.label) return props.label;
		return undefined;
	});

	// Lifecycle
	const emit = defineEmits<{
		(e: 'click', evt: MouseEvent): void;
	}>();

	const handleClick = (evt: MouseEvent) => {
		emit('click', evt);
	};
</script>
