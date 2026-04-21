<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-1">
				<template v-if="lastTimestamp > 0">
					<EventTime
						:timestamp="lastTimestamp"
						:show-date="true"
					></EventTime>
					<EventTime
						:timestamp="lastTimestamp"
						:show-date="false"
					></EventTime>
				</template>
				<Icon type="chat-circle-text" />
				<span>{{ nrOfReplies }}</span>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Components
	import EventTime from '@hub-client/components/rooms/EventTime.vue';

	// Models
	import Room from '@hub-client/models/rooms/Room';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
		lastTimestamp: {
			type: Number,
			default: 0,
		},
		room: {
			type: Room,
			required: true,
		},
	});

	const nrOfReplies = computed(() => {
		let count = 0;
		const currentThreadId = props.room.getCurrentThreadId();
		if (currentThreadId !== props.event.event_id && props.event.event_id) props.room.setCurrentThreadId(props.event.event_id);
		count = props.room.getCurrentThreadLength() - 1;
		if (currentThreadId !== props.event.event_id) props.room.setCurrentThreadId(currentThreadId);
		return count;
	});
</script>
