<template>
	<div id="room-timeline" class="room-timeline relative">
		<div class="fixed right-3">
			<OldEventsLoader v-if="!roomPaginationEnded" :room_id="room_id" @loaded="preventScroll = true"></OldEventsLoader>
		</div>
		<RoomEvent v-for="item in rooms.rooms[room_id].timeline" :key="item.event.eventId" :event="item.event"></RoomEvent>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, onBeforeUpdate, watch } from 'vue';
	import { useRooms } from '@/store/store';
	import { useRoute } from 'vue-router';
	const rooms = useRooms();
	const route = useRoute();
	onMounted(async () => {
		await rooms.storeRoomNotice(rooms.currentRoom?.roomId);
	});

	watch(route, async () => {
		await rooms.storeRoomNotice(rooms.currentRoom?.roomId);
	});

	const props = defineProps({
		room_id: {
			type: String,
			required: true,
		},
	});

	let roomPaginationEnded = ref(false);
	let preventScroll = ref(false);

	onMounted(() => {
		scrollToBottom();
	});

	onBeforeUpdate(() => {
		roomPaginationEnded.value = rooms.rooms[props.room_id].timeline[0].event.type == 'm.room.create';
		scrollToBottom();
	});

	function scrollToBottom() {
		if (!preventScroll.value) {
			window.setTimeout(() => {
				const el = document.getElementById('room-timeline');
				if (el !== null) {
					el.scrollIntoView(false);
				}
			}, 10);
		}
		preventScroll.value = false;
	}
</script>
