<template>
	<div
		class="bg-surface-base border-surface-elevated rounded-base flex w-fit items-center border-2"
		data-testid="forum-vote"
		@click.stop
	>
		<button
			class="rounded-l-base focus-visible:outline-accent-primary flex cursor-pointer items-center px-150 py-100 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
			:class="[myVote === VoteKey.Up ? 'text-accent-primary' : 'text-on-surface-dim hover:text-on-surface', busy && 'opacity-60']"
			type="button"
			:title="$t('message.forum.upvote')"
			:aria-label="$t('message.forum.upvote')"
			:aria-pressed="myVote === VoteKey.Up"
			:aria-disabled="busy"
			@click="vote(VoteKey.Up)"
		>
			<Icon
				type="arrow-up"
				size="sm"
			/>
		</button>
		<span class="text-label-small text-on-surface min-w-[2ch] text-center font-semibold">{{ score }}</span>
		<button
			class="rounded-r-base focus-visible:outline-accent-primary flex cursor-pointer items-center px-150 py-100 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2"
			:class="[myVote === VoteKey.Down ? 'text-accent-primary' : 'text-on-surface-dim hover:text-on-surface', busy && 'opacity-60']"
			type="button"
			:title="$t('message.forum.downvote')"
			:aria-label="$t('message.forum.downvote')"
			:aria-pressed="myVote === VoteKey.Down"
			:aria-disabled="busy"
			@click="vote(VoteKey.Down)"
		>
			<Icon
				type="arrow-down"
				size="sm"
			/>
		</button>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { type MatrixEvent } from 'matrix-js-sdk';
	import { computed, ref } from 'vue';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Logic
	import { VoteKey, getVoteEvents, tallyVotes } from '@hub-client/logic/forum/votes';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { Redaction, RelationType } from '@hub-client/models/constants';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
		eventId: string;
	}>();

	const logger = createLogger('ForumVote');
	const pubhubs = usePubhubsStore();
	const user = useUser();

	const voteEvents = computed(() => getVoteEvents(props.room, props.eventId));
	const voters = computed(() => tallyVotes(voteEvents.value));

	const score = computed(() => voters.value.up.size - voters.value.down.size);

	const myVote = computed<VoteKey | null>(() => {
		if (!user.userId) return null;
		if (voters.value.up.has(user.userId)) return VoteKey.Up;
		if (voters.value.down.has(user.userId)) return VoteKey.Down;
		return null;
	});

	const busy = ref(false);

	async function vote(key: VoteKey) {
		if (busy.value) return;
		busy.value = true;
		const myEvents = voteEvents.value.filter((event) => event.getSender() === user.userId);
		const sameKey = myEvents.filter((event) => event.getContent()[RelationType.RelatesTo]?.key === key);
		const otherKey = myEvents.filter((event) => event.getContent()[RelationType.RelatesTo]?.key !== key);
		try {
			// Switching direction retracts the opposite vote first
			await removeVotes(otherKey);
			if (sameKey.length > 0) {
				// Clicking the active direction retracts the vote
				await removeVotes(sameKey);
			} else {
				await pubhubs.addReactEvent(props.room.roomId, props.eventId, key);
			}
		} catch (e) {
			logger.error('Failed to update vote', { e });
		} finally {
			busy.value = false;
		}
	}

	async function removeVotes(events: MatrixEvent[]) {
		for (const event of events) {
			const eventId = event.getId();
			if (!eventId) continue;
			await pubhubs.client.redactEvent(props.room.roomId, eventId, undefined, { reason: Redaction.Deleted });
			props.room.addToRedactedEventIds(eventId);
		}
	}
</script>
