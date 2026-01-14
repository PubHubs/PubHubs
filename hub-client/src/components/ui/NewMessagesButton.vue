<template>
	<div class="animate-fade-in absolute bottom-20 z-50 flex w-full transform justify-center">
		<button
			@click="$emit('click')"
			class="bg-primary text-on-primary hover:bg-primary-dim shadow-elevation-2 flex items-center gap-2 rounded-full px-6 py-3 font-medium transition-all hover:cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95"
			:aria-label="$t('rooms.scroll_to_new_messages', { count })"
			:aria-keyshortcuts="'Control+End j'"
		>
			<Icon type="arrow-down" size="sm" />
			<span class="text-label">
				{{ count === 1 ? $t('rooms.one_new_message') : $t('rooms.new_messages', { count }) }}
			</span>
			<span class="sr-only">(Press Ctrl+End or J)</span>
		</button>
	</div>
</template>

<script setup lang="ts">
	import { onMounted, onUnmounted } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		count: {
			type: Number,
			required: true,
		},
	});

	const emit = defineEmits(['click']);
</script>
