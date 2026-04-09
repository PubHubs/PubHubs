<template>
	<div
		v-if="!topicId"
		class="mx-auto w-full overflow-y-scroll p-4"
	>
		<SubheaderForum />
		<ul
			v-if="events.length > 0"
			class="flex flex-col gap-y-2"
		>
			<li
				v-for="event in events"
				:key="event.matrixEvent.event_id"
			>
				<ForumThreadItem
					:event="event.matrixEvent.event"
					:room="room"
					:show-actions="false"
				></ForumThreadItem>
			</li>
		</ul>
	</div>
	<ForumThread
		v-if="currentTopic"
		:event="currentTopic"
		:room="room"
	></ForumThread>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Components
	import ForumThread from '@hub-client/components/rooms/forum/ForumThread.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		topicId: {
			type: String,
			default: undefined,
		},
	});
	const initialLoadComplete = ref(false);

	onMounted(() => {
		initialLoadComplete.value = true;
	});

	const events = computed(() => {
		return props.room.getChronologicalTimeline();
	});

	const currentTopic = computed(() => {
		if (events.value.length > 0 && props.topicId) {
			const topic = events.value.find((t) => t.matrixEvent.event.event_id === props.topicId);
			return topic?.matrixEvent.event;
		}
		return undefined;
	});
</script>
