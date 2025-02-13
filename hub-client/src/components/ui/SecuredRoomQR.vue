<template>
	<div
		id="yivi-login"
		class="w-[255px] after:absolute after:-top-[1.2em] after:left-[50%] after:border-[1.25em] after:border-r-0 after:border-t-0 after:border-transparent after:border-b-white after:drop-shadow-[0px_-5px_16px_rgb(0,0,0,0.15)]"
	></div>
</template>

<script setup lang="ts">
	import { SecuredRoomAttributeResult } from '@/dev/types';
	import { useRouter } from 'vue-router';
	import { useRooms } from '@/store/rooms';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { onMounted } from 'vue';

	const props = defineProps<{ securedRoomId: string }>();

	const rooms = useRooms();
	const pubhubs = usePubHubs();
	const router = useRouter();

	onMounted(() => rooms.yiviSecuredRoomflow(props.securedRoomId, resultOfEntry));

	const emit = defineEmits<{ (e: 'error', message: string): void }>();

	function resultOfEntry(result: SecuredRoomAttributeResult) {
		if (result.goto) {
			pubhubs.updateRooms().then(() => router.push({ name: 'room', params: { id: props.securedRoomId } }));
		} else if (result.not_correct) {
			emit('error', result.not_correct);
		}
	}
</script>
