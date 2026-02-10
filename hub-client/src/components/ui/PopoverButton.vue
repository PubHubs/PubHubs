<template>
	<button class="bg-surface-high hover:bg-surface flex h-18 w-36 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl p-4 hover:cursor-pointer" @click="click">
		<Icon :type="icon"></Icon>
		<p class="line-clamp-1 w-full"><slot></slot></p>
	</button>
</template>

<script setup lang="ts">
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	withDefaults(
		defineProps<{
			icon: string;
		}>(),
		{},
	);

	const emit = defineEmits(['click']);

	function click() {
		emit('click');
	}
</script>
