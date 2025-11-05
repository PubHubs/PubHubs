<template>
	<div class="relative z-50 h-full w-full shrink-0 overflow-y-auto bg-surface-low md:w-[33%]">
		<SideKickHeader>
			<span>{{ title }}</span>
			<Icon class="absolute right-2 cursor-pointer hover:text-accent-red" type="x" @click="close()"></Icon>
		</SideKickHeader>
		<div class="mt-4 flex flex-col p-3">
			<slot></slot>
		</div>
	</div>
</template>
<script setup lang="ts">
	const emit = defineEmits(['close']);

	const props = defineProps({
		title: {
			type: String,
			required: true,
		},
	});

	function close() {
		emit('close');
	}
</script>
