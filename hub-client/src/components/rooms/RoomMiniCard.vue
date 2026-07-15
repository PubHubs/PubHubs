<template>
	<div class="bg-surface-subtle relative min-h-full overflow-hidden rounded-md">
		<div class="relative">
			<div class="relative z-10 flex flex-row items-center justify-around px-4 py-4">
				<Icon type="chats-circle" />
				<Button @click="join(props.roomId)"> Join Room </Button>
			</div>
		</div>
	</div>
</template>
<script lang="ts" setup>
	import Button from '@hub-client/components/elements/Button.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';

	import { router } from '@hub-client/logic/core/router';

	const props = defineProps({
		roomId: {
			type: String,
			required: true,
		},
	});
	async function join(id: string) {
		await router.push({ name: 'room', params: { id: id } });
	}
</script>
