<template>
	<span class="truncate w-full inline-block" :title="slotText">
		<slot></slot>
	</span>
</template>

<script setup lang="ts">
	import { useSlots, computed, VNodeNormalizedChildren, isVNode } from 'vue';

	const slots = useSlots();
	const slotText = computed(() => {
		if (typeof slots.default !== 'undefined') {
			let text = '';
			let children: VNodeNormalizedChildren = slots.default()[0].children;
			// Traverse children tree so this could be used inside a slot of another component
			if (Array.isArray(children)) {
				children.forEach((child) => {
					if (isVNode(child) && child !== null) {
						text = child.children as string;
					}
				});
			}
			return text;
		}
		return '';
	});
</script>

<style scoped>
	p::before {
		content: normal;
		display: inline-block;
	}
</style>
