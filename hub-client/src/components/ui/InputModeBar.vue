<template>
	<div class="rounded-t-base flex h-500 items-center justify-between gap-100 border-b px-200" :class="containerClass">
		<div class="flex min-w-0 items-center gap-100">
			<Icon :type="icon" size="sm" class="shrink-0" :class="textClass" />
			<span class="text-label-small shrink-0" :class="textClass">{{ label }}</span>
			<span v-if="tooltip" :title="tooltip" class="shrink-0 hover:cursor-help">
				<Icon type="info" size="sm" class="text-on-surface-dim" />
			</span>
			<slot />
		</div>
		<button @click="$emit('close')" class="shrink-0 hover:cursor-pointer">
			<Icon type="x" size="sm" :class="textClass" />
		</button>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	const props = defineProps<{
		icon: string;
		label: string;
		variant: 'admin' | 'steward' | 'sign' | 'reply';
		tooltip?: string;
	}>();

	defineEmits<{
		close: [];
	}>();

	const containerClass = computed(() => {
		switch (props.variant) {
			case 'admin':
				return 'bg-accent-admin/10 border-accent-admin';
			case 'steward':
				return 'bg-accent-steward/10 border-accent-steward';
			case 'sign':
				return 'bg-accent-blue/10 border-accent-blue';
			case 'reply':
				return 'bg-accent-green/10 border-accent-green';
		}
	});

	const textClass = computed(() => {
		switch (props.variant) {
			case 'admin':
				return 'text-accent-admin';
			case 'steward':
				return 'text-accent-steward';
			case 'sign':
				return 'text-accent-blue';
			case 'reply':
				return 'text-accent-green';
		}
	});
</script>
