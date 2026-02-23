<template>
	<div class="flex flex-wrap gap-2" role="list" data-testid="reactions">
		<span v-for="item in reactionSummary" :key="item.key" class="group/reaction bg-surface relative inline-flex items-center gap-2 rounded-full px-3 py-1" role="listitem">
			<span class="flex h-[1em] w-[1em] items-center justify-center group-hover/reaction:hidden">{{ item.key }}</span>

			<!-- Show a trash icon on hovering a reaction that you made, which can be clicked to remove the reaction -->
			<Icon
				type="trash"
				@click.stop="removeReaction(item.reactions.filter((r) => r.userId === currentUserId).map((r) => r.eventId))"
				class="text-accent-red hover:text-button-red hidden h-[1em] w-[1em] hover:cursor-pointer"
				:class="item.reactions.some((r) => r.userId === currentUserId) && 'group-hover/reaction:block'"
			/>

			<!-- Show a + icon on hovering a reaction that someone else made, but you didn't make, which can be clicked to add a reaction with the same emoji -->
			<Icon
				type="plus-circle"
				@click.stop="addReaction(item.key)"
				class="text-accent-blue hover:text-button-blue hidden h-[1em] w-[1em] hover:cursor-pointer"
				:class="!item.reactions.some((r) => r.userId === currentUserId) && 'group-hover/reaction:block'"
			/>
			{{ item.count }}
		</span>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { MatrixEvent } from 'matrix-js-sdk';
	import { computed } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Models
	import { Redaction, RelationType } from '@hub-client/models/constants';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';

	// Props
	const props = defineProps<{ reactEvent: MatrixEvent[]; messageEventId: string }>();

	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const currentUserId = pubhubs.client.getUserId();

	const reactionSummary = computed(() => {
		if (!props.reactEvent) return;

		const reactionEvents = props.reactEvent.filter((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			return relatesTo && relatesTo.event_id === props.messageEventId && !rooms.currentRoom?.inRedactedMessageIds(event.getId()!);
		});

		// Map key -> list of { eventId, userId }
		const map: Record<string, { eventId: string; userId: string }[]> = {};

		for (const event of reactionEvents) {
			const key = event.getContent()[RelationType.RelatesTo]?.key;
			const eventId = event.getId();
			const userReacted = event.getSender();

			if (key) {
				if (!map[key]) map[key] = [];
				// Only add if eventId not already in map[key]
				if (!map[key].some((r) => r.eventId === eventId)) {
					map[key].push({ eventId, userId: userReacted });
				}
			}
		}
		return Object.entries(map).map(([key, reactions]) => ({
			key,
			count: reactions.length,
			reactions, // Array of { eventId, userId }
		}));
	});

	async function addReaction(emoji: string) {
		if (!rooms.currentRoom?.roomId) return;
		try {
			await pubhubs.addReactEvent(rooms.currentRoom.roomId, props.messageEventId, emoji);
		} catch (e) {
			console.error('Failed to add reaction', e);
		}
	}

	async function removeReaction(eventIds: string[]) {
		if (!rooms.currentRoom?.roomId) return;
		try {
			for (const eventId of eventIds) {
				await pubhubs.client.redactEvent(rooms.currentRoom?.roomId, eventId, undefined, { reason: Redaction.Deleted });
				rooms.currentRoom.addToRedactedEventIds(eventId);
			}
		} catch (e) {
			console.error('Failed to redact reaction event(s)', e);
		}
	}
</script>
