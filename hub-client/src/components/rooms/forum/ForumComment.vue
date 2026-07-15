<template>
	<div>
		<div
			:id="eventId"
			class="rounded-base"
		>
			<RoomMessageBubble
				:room="room"
				:event="node.event"
				:view-from-thread="true"
				:active-reaction-panel="activeReactionPanel"
				class="room-event"
				@clicked-emoticon="(emoji: string, id: string) => emit('clickedEmoticon', emoji, id)"
				@delete-message="(event: TMessageEvent) => emit('deleteMessage', event)"
				@reaction-panel-toggle="(id: string) => emit('reactionPanelToggle', id)"
				@reaction-panel-close="emit('reactionPanelClose')"
			/>

			<!-- Votes and reaction display for comment. Vote reactions (👍/👎) live in the
			     vote pill only and are excluded from the emoji chips. -->
			<div class="pb-050 flex flex-wrap items-center gap-100 px-800">
				<ForumVote
					v-if="!isDeletedComment"
					:room="room"
					:event-id="eventId"
				/>
				<Reaction
					v-if="hasNonVoteReactions"
					:react-event="nonVoteReactions"
					:message-event-id="eventId"
				/>
			</div>
		</div>

		<!-- Collapsed replies -->
		<button
			v-if="node.children.length > 0 && isCollapsed"
			class="group/collapse focus-visible:outline-accent-primary flex w-full cursor-pointer text-left focus-visible:outline-2"
			type="button"
			@click="collapsed = false"
		>
			<div
				v-if="indentChildren"
				class="flex w-400 shrink-0 justify-center py-100"
			>
				<span class="bg-on-surface-disabled/50 group-hover/collapse:bg-accent-primary w-025 rounded-full"></span>
			</div>
			<div class="py-050 flex min-w-0 flex-1 items-center pe-200">
				<span class="text-on-surface-dim group-hover/collapse:text-accent-primary text-xs">+{{ descendantCount }}</span>
			</div>
		</button>

		<!-- Nested replies -->
		<div
			v-if="node.children.length > 0 && !isCollapsed"
			class="flex"
		>
			<!-- Collapse handle: the vertical connector line, click to fold this branch -->
			<button
				v-if="indentChildren"
				class="group/collapse focus-visible:outline-accent-primary flex w-400 shrink-0 cursor-pointer justify-center py-100 focus-visible:outline-2 focus-visible:-outline-offset-2"
				type="button"
				:title="$t('message.forum.hide_replies')"
				:aria-label="$t('message.forum.hide_replies')"
				@click="collapsed = true"
			>
				<span class="bg-on-surface-disabled/50 group-hover/collapse:bg-accent-primary w-[2px] rounded-full"></span>
			</button>
			<div class="flex min-w-0 flex-1 flex-col">
				<TransitionGroup
					tag="ul"
					name="comments"
					class="flex flex-col"
				>
					<li
						v-for="child in visibleChildren"
						:key="child.event.matrixEvent.event.event_id"
					>
						<ForumComment
							:node="child"
							:room="room"
							:depth="indentChildren ? depth + 1 : depth"
							:max-depth="maxDepth"
							:active-reaction-panel="activeReactionPanel"
							:target-event-id="targetEventId"
							@clicked-emoticon="(emoji: string, id: string) => emit('clickedEmoticon', emoji, id)"
							@delete-message="(event: TMessageEvent) => emit('deleteMessage', event)"
							@reaction-panel-toggle="(id: string) => emit('reactionPanelToggle', id)"
							@reaction-panel-close="emit('reactionPanelClose')"
						/>
					</li>
				</TransitionGroup>
				<button
					v-if="hiddenSiblingsCount > 0"
					class="group/collapse focus-visible:outline-accent-primary flex w-full cursor-pointer text-left focus-visible:outline-2"
					type="button"
					@click="siblingsExpanded = true"
				>
					<div
						v-if="indentChildren"
						class="flex w-400 shrink-0 justify-center py-100"
					>
						<span class="bg-on-surface-disabled/50 group-hover/collapse:bg-accent-primary w-025 rounded-full"></span>
					</div>
					<div class="py-050 flex min-w-0 flex-1 items-center pe-200">
						<span class="text-on-surface-dim group-hover/collapse:text-accent-primary text-xs">+{{ hiddenSiblingsCount }}</span>
					</div>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, type MatrixEvent } from 'matrix-js-sdk';
	import { computed, ref } from 'vue';

	// Components
	import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';
	import ForumVote from '@hub-client/components/rooms/forum/ForumVote.vue';
	import Reaction from '@hub-client/components/ui/Reaction.vue';

	// Logic
	import { VoteKey } from '@hub-client/logic/forum/votes';

	// Models
	import { RelationType } from '@hub-client/models/constants';
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { type ForumCommentNode } from '@hub-client/models/forum/TForumComment';
	import type Room from '@hub-client/models/rooms/Room';

	const props = defineProps<{
		node: ForumCommentNode;
		room: Room;
		depth: number;
		maxDepth: number;
		activeReactionPanel: string | null;
		// A comment being jumped to (e.g. a search hit); the branch holding it must stay unfolded
		targetEventId?: string;
	}>();

	const emit = defineEmits<{
		(e: 'deleteMessage', event: TMessageEvent): void;
		(e: 'reactionPanelToggle', eventId: string): void;
		(e: 'reactionPanelClose'): void;
		(e: 'clickedEmoticon', emoji: string, eventId: string): void;
	}>();

	const collapsed = ref(false);

	const eventId = computed(() => props.node.event.matrixEvent.getId()!);

	// Deleted comments only remain as placeholders for their replies; no voting on those
	const isDeletedComment = computed(() => props.node.event.isDeleted || props.node.event.matrixEvent.isRedacted());

	// Past the maximum visual depth, deeper branches continue at the same indentation
	const indentChildren = computed(() => props.depth + 1 <= props.maxDepth);

	const descendantCount = computed(() => countDescendants(props.node));

	function countDescendants(node: ForumCommentNode): number {
		return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0);
	}

	/**
	 * A comment being jumped to has to be in the DOM to be scrolled to and highlighted, so a branch
	 * that holds it stays unfolded and shows all of its replies, whatever the reader folded before.
	 */
	const holdsTarget = computed(() => !!props.targetEventId && subtreeContains(props.node, props.targetEventId));

	function subtreeContains(node: ForumCommentNode, targetId: string): boolean {
		return node.children.some((child) => child.event.matrixEvent.getId() === targetId || subtreeContains(child, targetId));
	}

	const isCollapsed = computed(() => collapsed.value && !holdsTarget.value);

	// When a comment has many direct replies, only show the top N (sorted by votes via orderTree);
	// the remaining (less popular) ones are collapsed behind a "+N" button.
	const MAX_VISIBLE_SIBLINGS = 3;
	const siblingsExpanded = ref(false);

	const visibleChildren = computed(() => {
		if (siblingsExpanded.value || holdsTarget.value) return props.node.children;
		return props.node.children.slice(0, MAX_VISIBLE_SIBLINGS);
	});

	// Like the collapsed-branch button, "+N" counts every comment it hides, replies included
	const hiddenSiblingsCount = computed(() => {
		return props.node.children.slice(visibleChildren.value.length).reduce((sum, child) => sum + 1 + countDescendants(child), 0);
	});

	const reactionEvents = computed<MatrixEvent[]>(() => {
		if (isDeletedComment.value) return [];
		return props.room
			.getRelatedEventsByType(props.node.event.matrixEvent.getId()!, {
				eventType: EventType.Reaction,
				contentRelType: RelationType.Annotation,
			})
			.map((e) => e.matrixEvent as MatrixEvent);
	});

	function isVoteKey(key: string | undefined): boolean {
		return key === VoteKey.Up || key === VoteKey.Down;
	}

	const nonVoteReactions = computed(() => {
		return reactionEvents.value.filter((event) => !isVoteKey(event.getContent()[RelationType.RelatesTo]?.key));
	});

	const hasNonVoteReactions = computed(() => nonVoteReactions.value.length > 0);
</script>

<style scoped>
	.comments-move {
		transition: transform 0.4s ease;
	}
</style>
