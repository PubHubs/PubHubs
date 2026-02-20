<template>
	<div class="animate-fade-in absolute right-3 bottom-4 z-50 flex w-fit transform md:right-6">
		<button
			@click="$emit('click')"
			class="bg-surface-high text-on-surface hover:bg-surface shadow-elevation-2 flex items-center justify-center rounded-full transition-all hover:cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95"
			:class="count > 0 ? 'gap-2 px-4 py-3' : 'aspect-square p-3'"
			:aria-label="count > 0 ? $t('rooms.new_messages', { count }) : $t('rooms.jump_to_bottom')"
		>
			<Icon type="arrow-down" size="sm" />
			<span v-if="count > 0" class="text-label-small">
				{{ count === 1 ? $t('rooms.one_new_message') : $t('rooms.new_messages', { count }) }}
			</span>
		</button>
	</div>
</template>

<script setup lang="ts">
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		count: {
			type: Number,
			default: 0,
		},
	});

	defineEmits(['click']);
</script>
