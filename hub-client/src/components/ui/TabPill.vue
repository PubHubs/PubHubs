<template>
	<div
		:aria-selected="isActive"
		class="tabs-tab border-on-surface-disabled text-on-surface-dim focus:ring-button-blue z-20 min-h-550 cursor-pointer rounded-t border border-b-0 px-200 focus:ring-3 focus:outline-none"
		:class="[isActive ? 'bg-surface-background text-on-surface' : value !== undefined ? 'bg-transparent opacity-50' : 'bg-transparent']"
		role="tab"
		:tabindex="isActive ? -1 : 0"
		@click="activate"
		@keydown.enter="activate"
		@keydown.space.prevent="activate"
	>
		<div class="flex h-full w-full items-center justify-center">
			<slot :active="isActive" />
		</div>
	</div>
</template>

<script lang="ts" setup>
	import { type Ref, computed, inject } from 'vue';

	const props = defineProps<{
		value?: number;
	}>();

	const emit = defineEmits<{
		(e: 'select'): void;
	}>();

	const activeTab = inject<Ref<number>>('activeTab');
	const setActiveTab = inject<(tab: number) => void>('setActiveTab');

	const isActive = computed(() => props.value !== undefined && activeTab?.value === props.value);

	function activate() {
		if (props.value !== undefined) {
			setActiveTab?.(props.value);
		}
		emit('select');
	}
</script>

<style scoped>
	.tabs-tab {
		margin-bottom: -1px;
	}
</style>
