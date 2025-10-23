<template>
	<div class="flex flex-wrap gap-2" role="list" data-testid="reactions">
		<span v-for="(item, index) in reactionSummary" :key="item.key" class="group relative inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1" role="listitem">
			{{ item.key }} {{ item.count }}

			<Icon
				v-if="item.reactions.some((r) => r.userId === currentUserId)"
				type="remove"
				size="sm"
				class="absolute right-0 top-0 hidden cursor-pointer rounded-2xl bg-surface-low group-hover:inline-block"
				@click.stop="removeReaction(item.reactions.filter((r) => r.userId === currentUserId).map((r) => r.eventId))"
			/>
		</span>
	</div>
</template>

<script setup lang="ts">
	import Icon from '../elements/Icon.vue';
	import { MatrixEvent } from 'matrix-js-sdk';
	import { computed } from 'vue';

	import { RelationType } from '@hub-client/models/constants';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	const pubhubs = usePubhubsStore();
	const rooms = useRooms();

	const roomId = rooms.currentRoom?.roomId;
	const currentUserId = pubhubs.client.getUserId();

	const props = defineProps<{ reactEvent: MatrixEvent[]; messageEventId: string }>();

	const reactionSummary = computed(() => {
		if (!props.reactEvent) return;

		const reactionEvents = props.reactEvent.filter((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			return relatesTo && relatesTo.event_id === props.messageEventId && !rooms.currentRoom?.inRedactedMessageIds(event.getId());
		});

		// Map key -> list of { eventId, userId }
		const map: Record<string, { eventId: string; userId: string }[]> = {};

		for (const event of reactionEvents) {
			const key = event.getContent()[RelationType.RelatesTo]?.key;
			const eventId = event.getId();
			const userReacted = event.getSender();

			if (key) {
				if (!map[key]) map[key] = [];
				map[key].push({ eventId, userId: userReacted });
			}
		}
		return Object.entries(map).map(([key, reactions]) => ({
			key,
			count: reactions.length,
			reactions, // array of { eventId, userId }
		}));
	});

	async function removeReaction(eventIds: string[]) {
		if (!rooms.currentRoom?.roomId) return;
		try {
			for (const eventId of eventIds) {
				await pubhubs.client.redactEvent(rooms.currentRoom?.roomId, eventId);
				rooms.currentRoom.addToRedactedEventIds(eventId);
			}
		} catch (e) {
			console.error('Failed to redact reaction event(s)', e);
		}
	}
</script>
