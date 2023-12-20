<template>
	<div id="room-timeline" ref="elRoomTimeline" class="h-full overflow-y-auto relative" @scroll="onScroll">
		<template v-for="(item, index) in rooms.rooms[room_id]?.timeline || []" :key="index">
			<RoomEvent :eventId="item.event.event_id" :name="item.event.event_id" :event="item.event" class="room-event" @on-in-reply-to-click="onInReplyToClick"></RoomEvent>
		</template>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, watch } from 'vue';
	import { Room, useRooms, useUser } from '@/store/store';
	import { useRoute } from 'vue-router';
	import { usePubHubs } from '@/core/pubhubsStore';

	const rooms = useRooms();
	const user = useUser();
	const route = useRoute();
	const pubhubs = usePubHubs();

	const elRoomTimeline = ref<HTMLElement | null>(null);

	let newestEventId: string | undefined;

	type Props = {
		room_id: string;
	};

	const props = defineProps<Props>();


	onMounted(async () => {
		if (!rooms.currentRoomExists) return;
		newestEventId = rooms.currentRoom?.timeline.at(-1)?.event.event_id;

		await rooms.storeRoomNotice(rooms.currentRoom!.roomId);

		scrollToBottom();
	});

	// Watch for new messages.
	watch(() => rooms.currentRoom?.timeline.length, onTimelineChange);

	watch(route, async () => {
		if (rooms.currentRoomExists) {
			await rooms.storeRoomNotice(rooms.currentRoom!.roomId);
			scrollToBottom();
		}
	});

	async function onTimelineChange(newTimelineLength?: number, oldTimelineLength?: number) {
		if (!newTimelineLength || !oldTimelineLength) return;
		if (!elRoomTimeline.value) return;
		if (!rooms.currentRoom) return;
		if (!newEventsExist()) return;

		const newEvents = rooms.currentRoom.timeline.slice(oldTimelineLength);

		if (!isScrolling() || Room.containsUserSentEvent(user.user.userId, newEvents)) {
			setTimeout(scrollToBottom, 100);
		}

		newestEventId = rooms.currentRoom.getNewestEventId();
	}

	//#region Events

	async function onScroll(ev: Event) {
		if (!(ev.target instanceof HTMLElement)) return;
		if (!rooms.currentRoom) return;

		rooms.currentRoom.setUserIsScrolling(isScrolling());

		// If scrolled to the top of the screen, load older events.
		if (ev.target.scrollTop === 0) {
			const oldestEvent = rooms.rooms[props.room_id].timeline.find((event) => event.getType() == 'm.room.message');
			const oldestEventId = oldestEvent?.getId();
			await pubhubs.loadOlderEvents(rooms.currentRoomId);
			if (oldestEventId) {
				scrollToEvent(oldestEventId);
			}
		}
	}

	function onInReplyToClick(inReplyToId: string) {
		scrollToEvent(inReplyToId, {position: 'TopCenter', select: 'Highlight'});
	}

	//#endregion

	function scrollToBottom() {
		elRoomTimeline.value?.scrollTo(0, elRoomTimeline.value.scrollHeight);
	}


	async function scrollToEvent(eventId: string, options: {position: 'Top' | 'TopCenter', select?: 'Highlight' | 'Select'} = {position: 'Top'}) {
		if (!elRoomTimeline.value) return;

		await pubhubs.loadToMessage(rooms.currentRoomId, eventId);

		const elEvent = elRoomTimeline.value.querySelector(`[eventId="${eventId}"]`);
		if (!elEvent) return;

		// Scroll the event into view depending on the position option.
		elEvent.scrollIntoView();
		if (options.position == 'TopCenter') {
			elRoomTimeline.value.scrollTop -= elRoomTimeline.value.clientHeight * 1 / 3;
		}

		// Style the event depending on the select option.
		if (options.select == 'Highlight') {
			elEvent.classList.add('highlighted');
			window.setTimeout(() => {
				elEvent.classList.remove('highlighted');
			}, 2000);
		}
	}

	function isScrolling() {
		if (!elRoomTimeline.value) return false;

		// isScrolling is true if the user scrolled up 1/3 of the timeline element height from the bottom or more.
		return elRoomTimeline.value.scrollTop +
			4/3 * elRoomTimeline.value.clientHeight <
			elRoomTimeline.value.scrollHeight;
	}

	function newEventsExist(): boolean {
		if (!rooms.currentRoom) return false;
		return newestEventId !== rooms.currentRoom.timeline.at(-1)?.event.event_id;
	}

</script>

<style scoped>
	/* The highlight animation is used when scrolling to an event with the highlight option selected. */
  .room-event {
		background: none
	}

	.room-event.highlighted {
		animation: highlight 1s;
	}

	@keyframes highlight {
  0% {
    background: none;
  }
  70% {
    background: gray;
  }
	100% {
		background: none;
	}

}

</style>
