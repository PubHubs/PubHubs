<template>
	<div
		class="rounded-t-base flex h-500 items-center justify-between gap-100 border-b px-200"
		:class="containerClass"
	>
		<div class="flex min-w-0 items-center gap-100">
			<Icon
				class="shrink-0"
				:class="textClass"
				size="sm"
				:type="icon"
			/>
			<span
				class="text-label-small shrink-0"
				:class="textClass"
				>{{ label }}</span
			>
			<span
				v-if="tooltip"
				class="shrink-0 hover:cursor-help"
				:title="tooltip"
			>
				<Icon
					class="text-on-surface-dim"
					size="sm"
					type="info"
				/>
			</span>
			<slot />
		</div>
		<button
			class="shrink-0 hover:cursor-pointer"
			@click="$emit('close')"
		>
			<Icon
				:class="textClass"
				size="sm"
				type="x"
			/>
		</button>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	type Variant = 'admin' | 'steward' | 'sign' | 'reply';

	const props = defineProps<{
		icon: string;
		label: string;
		variant: Variant;
		tooltip?: string;
	}>();

	defineEmits<{
		close: [];
	}>();

	const variantStyles = {
		admin: {
			container: 'bg-accent-admin/10 border-accent-admin',
			text: 'text-accent-admin',
		},
		steward: {
			container: 'bg-accent-steward/10 border-accent-steward',
			text: 'text-accent-steward',
		},
		sign: {
			container: 'bg-accent-blue/10 border-accent-blue',
			text: 'text-accent-blue',
		},
		reply: {
			container: 'bg-accent-green/10 border-accent-green',
			text: 'text-accent-green',
		},
	} as const;

	const containerClass = computed(() => {
		return variantStyles[props.variant].container;
	});

	const textClass = computed(() => {
		return variantStyles[props.variant].text;
	});
</script>
