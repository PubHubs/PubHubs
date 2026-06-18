<template>
	<button
		class="bg-surface-base hover:bg-surface-elevated rounded-base border-surface-elevated flex h-fit w-2000 flex-col items-center justify-center gap-100 overflow-hidden border-3 p-200 shadow hover:cursor-pointer"
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
