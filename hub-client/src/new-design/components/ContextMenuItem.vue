<template>
	<button
		class="hover:bg-surface-base first-of-type:rounded-t-base last-of-type:rounded-b-base flex w-full items-center gap-200 first-of-type:pt-150 last-of-type:pb-150 hover:cursor-pointer disabled:cursor-not-allowed"
		role="menuitem"
		type="button"
		:aria-disabled="props.disabled ? 'true' : undefined"
		:aria-label="computedAriaLabel"
		:class="[disabled ? 'text-on-surface-dim' : variant ? variant : 'text-on-surface', isMobile ? 'gap-200 px-400 py-200' : 'border-l-4 px-200 py-150 not-focus:border-transparent', variant]"
		:disabled="disabled"
		:title="computedTitle"
		@click="handleClick"
	>
		<Icon v-if="icon" :type="icon" class="shrink-0" />
		<span class="truncate">{{ label }}</span>
	</button>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// New design
	import Icon from '@hub-client/new-design/components/Icon.vue';
	import { type ContextMenuItemProps, ContextVariant } from '@hub-client/new-design/models/contextMenu.models';

	// Props
	const props = withDefaults(defineProps<ContextMenuItemProps>(), {
		disabled: false,
		variant: '' as ContextVariant,
	});

	// Computed
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

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
