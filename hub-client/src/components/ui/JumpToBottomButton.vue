<template>
	<div class="animate-fade-in absolute right-150 bottom-200 z-50 flex w-fit transform md:right-300">
		<button
			:aria-label="count > 0 ? $t('rooms.new_messages', { count }) : $t('rooms.jump_to_bottom')"
			class="border-surface-elevated bg-surface text-on-surface hover:bg-surface-elevated shadow-elevation-2 flex items-center justify-center rounded border-3 transition-all hover:cursor-pointer motion-safe:hover:scale-105 motion-safe:active:scale-95"
			:class="count > 0 ? 'gap-100 px-200 py-150' : 'aspect-square p-150'"
			@click="$emit('click')"
		>
			<Icon
				size="sm"
				type="arrow-down"
			/>
			<span
				v-if="count > 0"
				class="text-label-small"
			>
				{{ count === 1 ? $t('rooms.one_new_message') : $t('rooms.new_messages', { count }) }}
			</span>
		</button>
	</div>
</template>

<script lang="ts" setup>
	import Icon from '@hub-client/components/elements/Icon.vue';

	defineProps({
		count: {
			type: Number,
			default: 0,
		},
	});

	defineEmits(['click']);
</script>
