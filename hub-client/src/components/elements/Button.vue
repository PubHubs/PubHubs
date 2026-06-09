<template>
	<button
		:aria-busy="loading ? 'true' : undefined"
		:aria-disabled="disabled || loading ? 'true' : undefined"
		:aria-label="computedAriaLabel"
		class="rounded-base relative inline-flex h-fit min-h-550 w-fit max-w-4000 shrink-0 items-center justify-center gap-100 py-100 font-medium transition select-none hover:cursor-pointer aria-busy:opacity-100! aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
		:class="computedClasses"
		:disabled="disabled || loading"
		:tabindex="nofocus ? -1 : undefined"
		:title="computedTitle"
		:type="type"
		@click="handleClick"
	>
		<!-- Primary icon -->
		<Icon
			v-if="icon && !loading"
			aria-hidden="true"
			:size="iconSize"
			:type="icon"
		/>

		<!-- Label -->
		<template v-if="slots.default">
			<div
				class="truncate"
				:class="loading && 'opacity-0'"
			>
				<slot />
			</div>
		</template>

		<!-- SR-only label -->
		<template v-else-if="slots['sr-label'] && !loading">
			<span class="sr-only">
				<slot name="sr-label" />
			</span>
		</template>

		<!-- Secondary icon -->
		<Icon
			v-if="secondaryIcon && !isIconOnly && !loading"
			aria-hidden="true"
			:size="iconSize"
			:type="secondaryIcon"
		/>

		<!-- Loading spinner -->
		<div
			v-if="loading"
			class="absolute flex h-full w-full items-center justify-center"
		>
			<Icon
				aria-hidden="true"
				class="animate-spin"
				type="spinner"
			/>
		</div>

		<!-- Loading indicator for SR -->
		<span
			v-if="loading"
			aria-live="polite"
			class="sr-only"
			role="status"
			>Loading...</span
		>
	</button>
</template>

<script lang="ts">
	// Variants
	const buttonVariants = {
		primary: 'bg-accent-blue-interactive text-on-accent-blue outline-accent-blue-interactive hover:opacity-75',
		secondary: 'bg-surface-sunken text-on-surface outline-accent-blue-interactive hover:opacity-75',
		tertiary: 'border border-1 -border-offset-1 border-surface-on-surface-dim outline-accent-blue-interactive hover:opacity-75',
		error: 'bg-accent-red-interactive text-on-accent-red outline-accent-red-interactive hover:opacity-75',
		primaryIcon: 'text-accent-blue-interactive outline-accent-blue-interactive hover:opacity-75 min-h-300 h-300! w-300!',
		secondaryIcon: 'text-on-surface-dim outline-accent-blue-interactive hover:opacity-75 min-h-300 h-300! w-300!',
		errorIcon: 'text-accent-error outline-accent-blue-interactive hover:opacity-75 min-h-300 h-300! w-300!',
	} as const;
	export type TVariant = keyof typeof buttonVariants;
</script>

<script lang="ts" setup>
	// Packages
	import { computed, inject, onMounted, useSlots } from 'vue';

	// New design
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';

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
			nofocus?: boolean;
		}>(),
		{
			variant: 'primary',
			icon: undefined,
			secondaryIcon: undefined,
			disabled: false,
			title: undefined,
			type: 'button',
			ariaLabel: undefined,
			size: '',
			loading: false,
			nofocus: false,
		},
	);

	//  Lifecycle
	const emit = defineEmits<{
		(e: 'click', evt: MouseEvent): void;
	}>();
	const logger = createLogger('Button');
	const slots = useSlots();

	const buttonGroupCombined = inject<boolean>('buttonGroupCombined', false);

	const isIconOnly = computed(() => !slots.default && props.icon);

	const iconSize = computed((): 'base' | 'sm' | undefined => {
		if (isIconOnly.value && props.size === '') return 'base';
		if (!isIconOnly.value && props.size === '') return 'sm';
		return props.size || undefined;
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
		const focusClass = props.nofocus ? '' : 'focus:outline-3';
		const iconClass = isIconOnly.value ? 'min-w-550 w-550 px-100' : 'min-w-1000 px-150'; // Required to make the icon-only button look square
		const combinedClass = buttonGroupCombined ? 'rounded-none first:rounded-l-md last:rounded-r-md' : '';
		return [variantClass, iconClass, focusClass, combinedClass];
	});

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
		if (import.meta.env.DEV) {
			if (isIconOnly.value && !props.ariaLabel && !props.title) {
				logger.warn(
					'[Button] Accessible name missing for icon-only button. Provide `ariaLabel` or `title` prop or `#sr-label` slot. [',
					props.type,
					props.variant,
					props.icon,
					']',
				);
			}
		}
	});
</script>
