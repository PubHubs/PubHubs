<template>
	<div class="rounded-t-base flex items-center justify-between gap-2 border-b px-4 py-2" :class="containerClass">
		<div class="flex items-center gap-2">
			<Icon :type="icon" size="sm" :class="textClass" />
			<span class="text-label-small" :class="textClass">{{ label }}</span>
			<span v-if="tooltip" :title="tooltip" class="hover:cursor-help">
				<Icon type="info" size="sm" class="text-on-surface-dim" />
			</span>
		</div>
		<button @click="$emit('close')" class="hover:cursor-pointer">
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
		variant: 'admin' | 'steward' | 'sign';
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
		}
	});
</script>
