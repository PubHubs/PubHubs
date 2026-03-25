<template>
	<div class="animate-fade-in absolute top-4 right-3 z-50 flex w-fit transform md:right-6">
		<button
			@click="$emit('click')"
			class="bg-surface-high text-on-surface hover:bg-surface shadow-elevation-2 flex items-center justify-center gap-2 rounded-full px-4 py-3 transition-all hover:cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95"
			:aria-label="$t('rooms.jump_to_unread_thread')"
		>
			<Icon type="arrow-up" size="sm" />
			<span class="text-label-small">
				{{ $t('rooms.jump_to_unread_thread') }}
			</span>
		</button>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineEmits(['click']);
</script>
