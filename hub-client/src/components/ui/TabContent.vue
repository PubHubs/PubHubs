<template>
	<div v-show="isActive" class="pt-2" role="tabpanel">
		<slot></slot>
	</div>
</template>

<script setup lang="ts">
	import { type Ref, computed, inject } from 'vue';

	const props = defineProps<{
		value: number;
	}>();

	const activeTab = inject<Ref<number>>('activeTab')!;
	const isActive = computed(() => activeTab.value === props.value);
</script>
