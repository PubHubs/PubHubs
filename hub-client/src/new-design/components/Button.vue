<!-- Original old button had the following characteristics (summary + how this version is improved):

- role="button" + manual focus management
-> New uses native <button> which handles keyboard activation (Enter/Space) and form submission semantics automatically.

- Separate iconLeft / iconRight props
-> New uses `icon` and `secondaryIcon` and supports icon-only state.

- Uses a composable `useFormInput()` to manage focus and ring state
-> New relies on CSS focus:ring utilities and :focus handling on native button; fewer moving parts and less coupling to external composables.

- No loading state or aria-busy
-> New adds `loading` prop, shows spinner, sets aria-busy and provides sr-only loading text to communicate loading state to screen readers.

- Tooltip / accessible name handling is implicit
-> New computes aria-label and title fallbacks and warns in dev when icon-only buttons lack accessible names.

- Disabled logic used stopImmediatePropagation in click handler
-> New uses native disabled attribute plus click guard in handleClick

- Class management spread across multiple objects and variables
-> New centralizes `buttonVariants` and `computedClasses` to make theme changes easier and reduce duplication.

- Type and prop validation was done manually
-> New leverages TypeScript with typed variant keys, typed props, and defaults for better DX and safety.

- Accessibility improvments overall:
-> aria-busy, aria-disabled, aria-label fallbacks, sr-only slot, role="status" for loading, focus ring behavior, and developer warnings make the new component more accessible. -->

<template>
	<button
		v-bind="attrs"
		class="rounded-base inline-flex h-fit min-h-550 w-fit max-w-3000 items-center justify-center gap-100 py-100 transition select-none hover:cursor-pointer focus:ring-3 focus:outline-none aria-busy:opacity-100! aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
		:aria-busy="props.loading ? 'true' : undefined"
		:aria-disabled="props.disabled || props.loading ? 'true' : undefined"
		:aria-label="computedAriaLabel"
		:disabled="props.disabled || props.loading"
		:class="computedClasses"
		:type="props.type"
		:title="computedTitle"
		@click="handleClick"
	>
		<!-- Primary icon -->
		<Icon v-if="props.icon && !props.loading" aria-hidden="true" :size="iconSize" :type="props.icon" />

		<!-- Label -->
		<template v-if="slots.default">
			<div class="truncate" :class="props.loading && 'opacity-0'">
				<slot></slot>
			</div>
		</template>

		<!-- SR-only label -->
		<template v-else-if="slots['sr-label'] && !props.loading">
			<span class="sr-only">
				<slot name="sr-label"></slot>
			</span>
		</template>

		<!-- Secondary icon -->
		<Icon v-if="props.secondaryIcon && !isIconOnly && !props.loading" aria-hidden="true" :size="iconSize" :type="props.secondaryIcon" />

		<!-- Loading spinner -->
		<div v-if="props.loading" class="absolute flex h-full w-full items-center justify-center">
			<Icon aria-hidden="true" class="animate-spin" type="spinner" />
		</div>

		<!-- Loading indicator for SR -->
		<span v-if="props.loading" class="sr-only" role="status" aria-live="polite">Loading...</span>
	</button>
</template>

<script lang="ts">
	// Variants
	const buttonVariants = {
		primary: 'bg-button-blue text-on-button-blue ring-on-accent-primary hover:opacity-75',
		secondary: 'bg-surface-base text-on-surface ring-button-blue hover:opacity-75',
		tertiary: 'outline outline-1 outline-offset-[-1px] outline-surface-on-surface-dim ring-button-blue hover:opacity-75',
		error: 'bg-button-red text-on-button-red ring-on-accent-error hover:opacity-75',
	} as const;
	export type TVariant = keyof typeof buttonVariants;
</script>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, useAttrs, useSlots } from 'vue';

	// Components
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
