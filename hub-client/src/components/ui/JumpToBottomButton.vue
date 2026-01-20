<template>
	<div class="animate-fade-in absolute bottom-20 z-50 flex w-full transform justify-center">
		<button
			@click="$emit('click')"
			class="bg-surface-high text-on-surface hover:bg-surface shadow-elevation-2 flex items-center justify-center rounded-full p-3 transition-all hover:cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95"
			:aria-label="$t('rooms.jump_to_bottom')"
		>
			<Icon type="arrow-down" size="sm" />
		</button>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineEmits(['click']);
</script>
