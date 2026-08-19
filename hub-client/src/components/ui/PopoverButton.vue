<template>
	<button
		class="bg-surface-base rounded-base border-surface-elevated flex h-fit w-2000 flex-col items-center justify-center gap-100 overflow-hidden border-3 p-200 shadow"
		:class="disabled ? 'cursor-not-allowed' : 'hover:bg-surface-elevated hover:cursor-pointer'"
		:disabled="disabled"
		@click="click"
	>
		<Icon
			:type="icon"
			:class="{ 'opacity-50': disabled }"
		/>
		<p
			class="line-clamp-1 w-full"
			:class="{ 'opacity-50': disabled }"
		>
			<slot />
		</p>
	</button>
</template>

<script lang="ts" setup>
	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Props
	const props = withDefaults(
		defineProps<{
			icon: string;
			disabled?: boolean;
		}>(),
		{ disabled: false },
	);

	const emit = defineEmits(['click']);

	function click() {
		if (props.disabled) return;
		emit('click');
	}
</script>
