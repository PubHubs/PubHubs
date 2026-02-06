<template>
	<button
		v-bind="attrs"
		class="rounded-base relative inline-flex h-fit min-h-550 w-fit max-w-3000 items-center justify-center gap-100 py-100 transition select-none hover:cursor-pointer focus:ring-3 focus:outline-none aria-busy:opacity-100! aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
		:aria-busy="loading ? 'true' : undefined"
		:aria-disabled="disabled || loading ? 'true' : undefined"
		:aria-label="computedAriaLabel"
		:disabled="disabled || loading"
		:class="computedClasses"
		:type="type"
		:title="computedTitle"
		@click="handleClick"
	>
		<!-- Primary icon -->
		<Icon v-if="icon && !loading" aria-hidden="true" :size="iconSize" :type="icon" />

		<!-- Label -->
		<template v-if="slots.default">
			<div class="truncate" :class="loading && 'opacity-0'">
				<slot></slot>
			</div>
		</template>

		<!-- SR-only label -->
		<template v-else-if="slots['sr-label'] && !loading">
			<span class="sr-only">
				<slot name="sr-label"></slot>
			</span>
		</template>

		<!-- Secondary icon -->
		<Icon v-if="secondaryIcon && !isIconOnly && !loading" aria-hidden="true" :size="iconSize" :type="secondaryIcon" />

		<!-- Loading spinner -->
		<div v-if="loading" class="absolute flex h-full w-full items-center justify-center">
			<Icon aria-hidden="true" class="animate-spin" type="spinner" />
		</div>

		<!-- Loading indicator for SR -->
		<span v-if="loading" class="sr-only" role="status" aria-live="polite">Loading...</span>
	</button>
</template>

<script lang="ts">
	// Variants
	const buttonVariants = {
		primary: 'bg-button-blue text-on-button-blue ring-on-accent-primary hover:opacity-75',
		secondary: 'bg-surface-base text-on-surface ring-button-blue hover:opacity-75',
		tertiary: 'outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim ring-button-blue hover:opacity-75',
		error: 'bg-button-red text-on-button-red ring-on-accent-error hover:opacity-75',
		primaryIcon: 'text-button-blue ring-on-accent-primary hover:opacity-75 min-h-300! h-300! w-300!',
		secondaryIcon: 'text-on-surface-dim ring-button-blue hover:opacity-75 min-h-300! h-300! w-300!',
	} as const;
	export type TVariant = keyof typeof buttonVariants;
</script>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, useAttrs, useSlots } from 'vue';

	// New design
	import Icon from '@hub-client/new-design/components/Icon.vue';

	const attrs = useAttrs();
	const slots = useSlots();

	// Props
	const props = withDefaults(
		defineProps<{
			variant?: TVariant;
			icon?: string;
			secondaryIcon?: string;
			disabled?: boolean;
			title?: string;
			size?: 'base' | 'sm' | '';
			type?: 'button' | 'submit' | 'reset';
			ariaLabel?: string;
			loading?: boolean;
		}>(),
		{
			variant: 'primary',
			disabled: false,
			type: 'button',
			size: '',
			loading: false,
		},
	);

	// Computed props
	const isIconOnly = computed(() => !slots.default && props.icon);

	const iconSize = computed(() => {
		if (isIconOnly.value && props.size === '') return 'base';
		if (!isIconOnly.value && props.size === '') return 'sm';
		return props.size;
	});

	// Sets the aria label (used by screen readers when there is no visible text), as a fallback for sr-label
	const computedAriaLabel = computed(() => {
		if (slots.default) return slots.default()[0].children?.toString();
		if (slots['sr-label']) return slots['sr-label']()[0].children?.toString();
		if (props.title) return props.title;
		return props.ariaLabel ?? undefined;
	});

	// Sets the tooltip value when not explicitly passed
	const computedTitle = computed(() => {
		if (props.title) return props.title;
		if (computedAriaLabel.value) return computedAriaLabel.value;
		if (slots.default) return slots.default()[0].children?.toString();
		return undefined;
	});

	const computedClasses = computed(() => {
		const variantClass = buttonVariants[props.variant ?? 'primary'];
		const iconClass = isIconOnly.value ? 'min-w-550 w-550 px-100' : 'min-w-1000 px-150'; // Required to make the icon-only button look square
		return [variantClass, iconClass];
	});

	//  Lifecycle
	const emit = defineEmits<{
		(e: 'click', evt: MouseEvent): void;
	}>();

	const handleClick = (evt: MouseEvent) => {
		if (props.disabled || props.loading) {
			evt.preventDefault();
			evt.stopPropagation();
			return;
		}
		emit('click', evt);
	};

	// Accessibility
	onMounted(() => {
		if (process.env.NODE_ENV !== 'production') {
			if (isIconOnly.value && !props.ariaLabel && !props.title) {
				console.warn('[Button] Accessible name missing for icon-only button. Provide `ariaLabel` or `title` prop or `#sr-label` slot.');
			}
		}
	});
</script>
