<template>
	<div class="relative z-50 h-full w-full shrink-0 overflow-y-auto bg-surface-low md:w-[33%]">
		<SideKickHeader>
			<span>{{ title }}</span>
			<Icon class="absolute right-3 top-3 hover:text-accent-red" type="close" size="sm" @click="close()"></Icon>
		</SideKickHeader>
		<div class="mt-4 flex flex-col p-3">
			<slot></slot>
		</div>
	</div>
</template>
<script setup lang="ts">
	const props = defineProps({
		title: {
			type: String,
			required: true,
		},
	});

	const emit = defineEmits(['close']);

	function close() {
		emit('close');
	}
</script>
