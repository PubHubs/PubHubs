<template>
	<div class="flex flex-wrap gap-2" role="list" data-testid="reactions">
		<div v-for="item in reactionSummary" :key="item.key" class="bg-surface rounded-full">
			<span
				class="group/reaction relative inline-flex cursor-pointer items-center gap-2 rounded-full px-3 py-1"
				:class="item.hasUserReacted ? 'bg-accent-blue/30 border-accent-blue border' : 'border border-transparent'"
				role="listitem"
				:title="item.tooltipTitle"
				@click.stop="toggleReaction(item)"
			>
				<span class="flex h-[1em] w-[1em] items-center justify-center">{{ item.key }}</span>
				{{ item.count }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { MatrixEvent } from 'matrix-js-sdk';
	import { computed } from 'vue';

	// Models
	import { Redaction, RelationType } from '@hub-client/models/constants';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Types
	type ReactionItem = {
		key: string;
		count: number;
		reactions: { eventId: string; userId: string }[];
		hasUserReacted: boolean;
		tooltipTitle: string;
	};

	// Props
	const props = defineProps<{ reactEvent: MatrixEvent[]; messageEventId: string }>();

	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const userStore = useUser();
	const currentUserId = pubhubs.client.getUserId();

	const MAX_USERS_IN_TOOLTIP = 3;

	function toggleReaction(item: ReactionItem) {
		if (item.hasUserReacted) {
			const eventIds = item.reactions.filter((r) => r.userId === currentUserId).map((r) => r.eventId);
			removeReaction(eventIds);
		} else {
			addReaction(item.key);
		}
	}

	const reactionSummary = computed(() => {
		if (!props.reactEvent) return;

		const reactionEvents = props.reactEvent.filter((event) => {
			const relatesTo = event.getContent()[RelationType.RelatesTo];
			return relatesTo && relatesTo.event_id === props.messageEventId && !rooms.currentRoom?.inRedactedMessageIds(event.getId()!);
		});

		const map: Record<string, { eventId: string; userId: string }[]> = {};

		for (const event of reactionEvents) {
			const key = event.getContent()[RelationType.RelatesTo]?.key;
			const eventId = event.getId();
			const userReacted = event.getSender();

			if (key) {
				if (!map[key]) map[key] = [];
				if (!map[key].some((r) => r.eventId === eventId)) {
					map[key].push({ eventId, userId: userReacted });
				}
			}
		}
		return Object.entries(map).map(([key, reactions]) => {
			const validReactions = reactions.filter((r) => r.userId);
			const names = validReactions.map((r) => userStore.userDisplayName(r.userId) ?? r.userId);
			let tooltipTitle: string;
			if (names.length <= MAX_USERS_IN_TOOLTIP) {
				tooltipTitle = names.join(', ');
			} else {
				tooltipTitle = names.slice(0, MAX_USERS_IN_TOOLTIP).join(', ') + ` +${names.length - MAX_USERS_IN_TOOLTIP}`;
			}
			return {
				key,
				count: validReactions.length,
				reactions: validReactions,
				hasUserReacted: validReactions.some((r) => r.userId === currentUserId),
				tooltipTitle,
			};
		});
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
