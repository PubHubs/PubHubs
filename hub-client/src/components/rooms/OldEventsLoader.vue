<template>
	<Button class="float-right absolute -top-11 right-0" @click="loadOldMessages()">
		<Icon type="chevron-up"></Icon>
	</Button>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';

	const pubhubs = usePubHubs();
	const emit = defineEmits(['loaded']);

	const props = defineProps({
		room_id: {
			type: String,
			required: true,
		},
	});

	async function loadOldMessages() {
		await pubhubs.loadOlderEvents(props.room_id);
		emit('loaded');
	}
</script>
