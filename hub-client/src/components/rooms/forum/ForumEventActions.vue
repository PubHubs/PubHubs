<template>
	<div class="flex flex-col justify-between gap-2">
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-center gap-1">
				<template v-if="event.timestamp > 0">
					<EventTime
						:timestamp="event.timestamp"
						:show-date="true"
					></EventTime>
					<EventTime
						:timestamp="event.timestamp"
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
		room: {
			type: Room,
			required: true,
		},
	});

	const nrOfReplies = computed(() => {
		if (!props.event.event.matrixEvent.thread) return 0;
		return props.event.event.matrixEvent.thread.length;
	});
</script>
