<template>
	<div class="bg-surface-subtle relative min-h-full overflow-hidden rounded-md">
		<div class="relative">
			<div class="bg-on-surface-dim absolute top-0 left-0 h-[50%] w-full"></div>
			<div class="relative z-10 flex flex-row items-center justify-around px-4 py-4">
				<Icon type="chats-circle" size="xl"></Icon>
				<Button @click="router.push({ name: 'room', params: { id: props.roomId } })"> Join Room </Button>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
	import Button from '../elements/Button.vue';
	import Icon from '../elements/Icon.vue';

	import { router } from '@hub-client/logic/core/router';

	const props = defineProps({
		roomId: {
			type: String,
			required: true,
		},
	});
</script>
