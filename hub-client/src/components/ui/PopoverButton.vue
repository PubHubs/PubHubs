<template>
	<button
		class="bg-surface-high hover:bg-surface rounded-base flex h-18 w-36 flex-col items-center justify-center gap-2 overflow-hidden p-4 hover:cursor-pointer"
		@click="click"
	>
		<Icon :type="icon" />
		<p class="line-clamp-1 w-full">
			<slot />
		</p>
	</button>
</template>

<script lang="ts" setup>
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
