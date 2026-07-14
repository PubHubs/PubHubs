<template>
	<div class="flex h-full w-full flex-col overflow-hidden">
		<!-- Breadcrumb back to the feed: bar above the scroll area -->
		<button
			v-if="!isMobile"
			class="border-on-surface-disabled/25 bg-background group hover:bg-surface-base text-on-surface-dim flex w-full shrink-0 items-center gap-100 border-b-2 p-200 hover:cursor-pointer"
			type="button"
			@click="backToFeed()"
		>
			<Icon
				size="sm"
				type="caret-left"
			/>
			<span class="text-body-small">{{ $t('message.forum.all_posts') }}</span>
		</button>
		<div
			ref="elPostView"
			class="w-full flex-1 overflow-x-hidden overflow-y-auto"
		>
			<div
				class="flex w-full flex-col"
				:class="isMobile ? 'pt-500' : 'pt-300'"
			>
				<!-- Post -->
				<article
					v-if="rootEvent"
					class="border-on-surface-disabled/25 mx-300 mb-300 flex flex-col gap-100 border-b pb-300"
				>
					<div class="flex flex-wrap items-center gap-100">
						<Avatar
							:avatar-url="user.userAvatar(sender)"
							:user-id="sender"
							:room-id="room.roomId"
						/>
						<UserDisplayName
							:user-id="sender"
							:user-display-name="user.userDisplayName(sender)"
							:room-id="room.roomId"
						/>
						<RoomBadge
							class="inline-block"
							:user="sender"
							:room-id="room.roomId"
						/>
						<span class="text-label-tiny text-on-surface-dim gap-050 inline-flex items-center">
							<EventTime
								:timestamp="rootEvent.matrixEvent.getTs()"
								:show-date="true"
							/>
							<EventTime
								:timestamp="rootEvent.matrixEvent.getTs()"
								:show-date="false"
							/>
						</span>
						<button
							v-if="postMenuItems.length > 0"
							class="text-accent-primary hover:bg-accent-primary hover:text-on-accent-primary focus-visible:outline-accent-primary p-050 ml-auto flex cursor-pointer items-center justify-center rounded-md focus-visible:outline-2"
							type="button"
							:title="$t('message.context_menu')"
							@click.stop="openMenu($event, postMenuItems, rootEvent.matrixEvent.getId())"
						>
							<Icon type="dots-three-vertical" />
						</button>
					</div>

					<H2 class="text-on-surface wrap-break-words">{{ title }}</H2>
					<ForumEventBody
						:event="rootEvent"
						class="pt-0!"
					/>
					<div class="flex items-center pt-100">
						<ForumVote
							:room="room"
							:event-id="topicId"
						/>
					</div>

					<ForumThreadDialog
						:id="room.roomId"
						:event="rootEvent.matrixEvent.event as TMessageEvent"
						:open="editingTopic"
						@update:open="editingTopic = $event"
					/>
				</article>

				<!-- Comments -->
				<div class="mx-300 mb-100 flex items-baseline gap-100">
					<H3 class="text-on-surface">{{ $t('message.forum.comments') }}</H3>
					<span class="text-on-surface-dim text-label-small">{{ nrOfComments }}</span>
				</div>

				<div
					v-if="!commentsReady"
					role="status"
					:aria-label="$t('common.loading')"
				>
					<InlineSpinner class="mx-auto my-100" />
				</div>
				<p
					v-else-if="commentTree.length === 0"
					class="text-on-surface-dim py-200"
				>
					{{ $t('message.forum.no_comments') }}
				</p>
				<TransitionGroup
					v-else
					tag="ul"
					name="comments"
					class="flex flex-col gap-100"
				>
					<li
						v-for="node in commentTree"
						:key="node.event.matrixEvent.event.event_id"
					>
						<ForumComment
							:node="node"
							:room="room"
							:depth="0"
							:max-depth="maxDepth"
							:active-reaction-panel="activeReactionPanel"
							:target-event-id="eventIdToScroll"
							@clicked-emoticon="sendEmoji"
							@delete-message="confirmDeleteMessage"
							@reaction-panel-toggle="toggleReactionPanel"
							@reaction-panel-close="closeReactionPanel"
						/>
					</li>
				</TransitionGroup>
			</div>
		</div>

		<!-- Comment composer, pinned under the comments like the timeline's message bar -->
		<MessageInput
			:room="room"
			:in-thread="true"
			class="shrink-0"
		/>
	</div>

	<!-- Delete message dialog -->
	<DeleteMessageDialog
		v-if="showConfirmDelMsgDialog && eventToBeDeleted"
		:event="eventToBeDeleted"
		:room="room"
		:view-from-thread="true"
		@close="showConfirmDelMsgDialog = false"
		@yes="(reason?: string) => deleteMessage(eventToBeDeleted!, reason)"
	></DeleteMessageDialog>

	<!-- Report dialog for the post itself -->
	<ReportDialog
		v-if="reportDialog.visible"
		@close="reportDialog.visible = false"
		@submit="onReportDialogSubmit"
	></ReportDialog>
</template>

<script setup lang="ts">
	// Packages
	import { EventType } from 'matrix-js-sdk';
	import { capitalize, computed, nextTick, onUnmounted, ref, shallowReactive, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { useRouter } from 'vue-router';

	// Components
	import H2 from '@hub-client/components/elements/H2.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import DeleteMessageDialog from '@hub-client/components/forms/DeleteMessageDialog.vue';
	import MessageInput from '@hub-client/components/forms/MessageInput.vue';
	import ReportDialog from '@hub-client/components/forms/ReportDialog.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import ForumComment from '@hub-client/components/rooms/forum/ForumComment.vue';
	import ForumEventBody from '@hub-client/components/rooms/forum/ForumEventBody.vue';
	import ForumThreadDialog from '@hub-client/components/rooms/forum/ForumThreadDialog.vue';
	import ForumVote from '@hub-client/components/rooms/forum/ForumVote.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useModerationCreateReport } from '@hub-client/composables/moderation/create-report.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { getVoteEvents, getVoteScore } from '@hub-client/logic/forum/votes';

	// Models
	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import { RelationType } from '@hub-client/models/constants';
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import { type ForumCommentNode } from '@hub-client/models/forum/TForumComment';
	import type Room from '@hub-client/models/rooms/Room';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		room: Room;
		topicId: string;
		// A comment to jump to, e.g. a search hit inside this post
		eventIdToScroll?: string;
	}>();

	const { t } = useI18n();
	const router = useRouter();
	const pubhubs = usePubhubsStore();
	const rooms = useRooms();
	const roles = useRoles();
	const settings = useSettings();
	const user = useUser();
	const sidebar = useSidebar();
	const { openMenu } = useContextMenu();
	const { reportDialog, openReportDialog, onReportDialogSubmit } = useModerationCreateReport();

	const isMobile = computed(() => settings.isMobileState);
	// Reddit-style depth cap: deeper branches continue at the same indentation
	const maxDepth = computed(() => (isMobile.value ? 3 : 6));

	const elPostView = ref<HTMLElement | null>(null);
	// Comments already on screen; anything outside it that is yours is a comment you just posted
	const knownCommentIds = new Set<string>();
	let commentsSeeded = false;
	const threadEvents: TimelineEvent[] = shallowReactive<TimelineEvent[]>([]);
	const loadingEvents = ref(false);
	const activeReactionPanel = ref<string | null>(null);
	const showConfirmDelMsgDialog = ref(false);
	const eventToBeDeleted = ref<TMessageEvent>();
	const editingTopic = ref(false);

	const rootEvent = computed(() => props.room.getCurrentThreadRoot());
	const sender = computed(() => rootEvent.value!.matrixEvent.getSender()!);
	const title = computed(() => rootEvent.value?.matrixEvent.event.content?.body ?? '');

	const nrOfComments = computed(() => {
		return rooms.threadLengths[props.room.roomId]?.[props.topicId] ?? comments.value.length;
	});

	const comments = computed(() => {
		return threadEvents.filter((event) => event.matrixEvent.getType() !== EventType.Reaction && event.matrixEvent.getId() !== props.topicId);
	});

	/**
	 * The comment this one explicitly replies to, if any. Fallback replies (is_falling_back) that
	 * other Matrix clients attach to every thread message do not count as explicit replies, so a
	 * reply to the post itself has no parent comment.
	 */
	function parentCommentId(event: TimelineEvent): string | undefined {
		const relatesTo = event.matrixEvent.getContent()[RelationType.RelatesTo];
		if (relatesTo?.is_falling_back === true) return undefined;
		const inReplyToId = relatesTo?.[RelationType.InReplyTo]?.[RelationType.EventId];
		return inReplyToId && inReplyToId !== event.matrixEvent.getId() ? inReplyToId : undefined;
	}

	/**
	 * Builds the nested comment tree from the flat Matrix thread. A comment nests under the
	 * comment its m.in_reply_to points at; everything else (including replies to the post
	 * itself) is a top-level comment.
	 */
	const commentTree = computed<ForumCommentNode[]>(() => {
		const nodes = new Map<string, ForumCommentNode>();
		for (const event of comments.value) {
			nodes.set(event.matrixEvent.getId()!, { event, children: [] });
		}
		const topLevel: ForumCommentNode[] = [];
		for (const node of nodes.values()) {
			const parentId = parentCommentId(node.event);
			const parent = parentId ? nodes.get(parentId) : undefined;
			if (parent) {
				parent.children.push(node);
			} else {
				topLevel.push(node);
			}
		}
		return orderTree(pruneDeleted(topLevel));
	});

	// Deleted comments only stay visible (as 'deleted') when replies hang off them
	function pruneDeleted(nodes: ForumCommentNode[]): ForumCommentNode[] {
		return nodes
			.map((node) => ({ ...node, children: pruneDeleted(node.children) }))
			.filter((node) => node.children.length > 0 || (!node.event.isDeleted && !node.event.matrixEvent.isRedacted()));
	}

	function byTime(a: ForumCommentNode, b: ForumCommentNode): number {
		return a.event.matrixEvent.getTs() - b.event.matrixEvent.getTs();
	}

	/**
	 * Vote-based ordering is applied once, when the vote events have settled after loading,
	 * and then frozen for the rest of the visit (sortRanks). This prevents comments from
	 * jumping around while reactions stream in, or mid-read when someone votes. Scores keep
	 * updating live; comments that arrive after the freeze are not ranked and are placed
	 * where the reader expects them (see orderTree). A refresh re-ranks everything.
	 */
	const sortRanks = ref<Map<string, number> | null>(null);
	let settleTimer: ReturnType<typeof setTimeout> | null = null;
	let settleCapTimer: ReturnType<typeof setTimeout> | null = null;
	const VOTE_SETTLE_MS = 400;
	const VOTE_SETTLE_CAP_MS = 2000;

	// Comments stay behind the loading indicator until the order is final, so they never visibly reorder
	const commentsReady = computed(() => !loadingEvents.value && sortRanks.value !== null);

	/**
	 * Comments that arrived after the freeze have no rank, and are placed where the person who
	 * just wrote one expects to find it: a new top-level comment goes last, directly above the
	 * composer; a new reply goes first under the comment it answers, newest first. Ranked
	 * comments keep their frozen vote order.
	 */
	function orderTree(nodes: ForumCommentNode[], topLevel = true): ForumCommentNode[] {
		const ranks = sortRanks.value;
		if (ranks) {
			const unranked = topLevel ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
			const rankOf = (node: ForumCommentNode) => ranks.get(node.event.matrixEvent.getId()!) ?? unranked;
			nodes.sort((a, b) => {
				const rankA = rankOf(a);
				const rankB = rankOf(b);
				if (rankA !== rankB) return rankA - rankB;
				// Two new replies to the same comment: the newest one sits on top
				return rankA === Number.MIN_SAFE_INTEGER ? byTime(b, a) : byTime(a, b);
			});
		} else {
			nodes.sort(byTime);
		}
		nodes.forEach((node) => orderTree(node.children, false));
		return nodes;
	}

	function computeVoteRanks(): Map<string, number> {
		// Score every comment once, rather than re-scanning its votes on each comparison
		const scores = new Map<string, number>();
		for (const comment of comments.value) {
			const eventId = comment.matrixEvent.getId()!;
			scores.set(eventId, getVoteScore(props.room, eventId));
		}

		// Best comments first on every level; equally voted comments stay in conversation order
		const byVotes = (a: ForumCommentNode, b: ForumCommentNode): number => {
			return (scores.get(b.event.matrixEvent.getId()!) ?? 0) - (scores.get(a.event.matrixEvent.getId()!) ?? 0) || byTime(a, b);
		};

		const ranks = new Map<string, number>();
		let counter = 0;
		const walk = (nodes: ForumCommentNode[]) => {
			for (const node of [...nodes].sort(byVotes)) {
				ranks.set(node.event.matrixEvent.getId()!, counter++);
				walk(node.children);
			}
		};
		walk(commentTree.value);
		return ranks;
	}

	// Changes whenever any comment gains or loses a vote; used to detect when votes settled
	const voteSignature = computed(() => {
		return comments.value.reduce((sum, comment) => sum + getVoteEvents(props.room, comment.matrixEvent.getId()!).length, 0);
	});

	watch([loadingEvents, voteSignature], () => {
		if (sortRanks.value || loadingEvents.value) return;
		// Nothing to sort: render right away
		if (comments.value.length === 0) {
			freezeVoteOrder();
			return;
		}
		// Freeze once the votes have been quiet for a moment, but never wait longer than the cap
		if (!settleCapTimer) {
			settleCapTimer = setTimeout(freezeVoteOrder, VOTE_SETTLE_CAP_MS);
		}
		if (settleTimer) clearTimeout(settleTimer);
		settleTimer = setTimeout(freezeVoteOrder, VOTE_SETTLE_MS);
	});

	function freezeVoteOrder() {
		clearSettleTimers();
		if (sortRanks.value) return;
		sortRanks.value = computeVoteRanks();
	}

	function clearSettleTimers() {
		if (settleTimer) clearTimeout(settleTimer);
		if (settleCapTimer) clearTimeout(settleCapTimer);
		settleTimer = null;
		settleCapTimer = null;
	}

	const postMenuItems = computed<MenuItem[]>(() => {
		const root = rootEvent.value;
		if (!root) return [];
		const items: MenuItem[] = [];
		const postSender = root.matrixEvent.getSender();
		// Editing the topic (title + description together) goes through the same form as creating one.
		if (settings.isFeatureEnabled(FeatureFlag.editMessages) && postSender === user.userId && !root.matrixEvent.isRedacted()) {
			items.push({
				label: t('message.forum.edit_thread'),
				icon: 'pencil-simple',
				onClick: () => (editingTopic.value = true),
			});
		}
		if (postSender !== user.userId) {
			items.push({
				label: capitalize(t('moderation.report_message')),
				icon: 'warning',
				onClick: () => openReportDialog(props.room.roomId, props.topicId),
			});
		}
		if (settings.isFeatureEnabled(FeatureFlag.deleteMessages) && (postSender === user.userId || roles.userIsStewardOrHigher(props.room.roomId))) {
			items.push({
				label: t('menu.delete_message'),
				icon: 'trash',
				variant: ContextVariant.delicate,
				onClick: () => confirmDeleteMessage(root.matrixEvent.event as TMessageEvent),
			});
		}
		return items;
	});

	watch(
		() => props.room.threadUpdated,
		() => nextTick(() => getThreadEvents()),
	);

	watch(
		() => props.topicId,
		() => changeTopic(),
		{ immediate: true },
	);

	// The jump target is handed over while the comments are still behind the loading spinner, so wait
	// for them to be on screen. A hit on the post itself needs no jump: the post is already on top.
	watch(
		[() => props.eventIdToScroll, commentsReady],
		([eventId, ready]) => {
			if (!eventId || !ready || eventId === props.topicId) return;
			nextTick(() => scrollToComment(eventId));
		},
		{ immediate: true },
	);

	onUnmounted(() => {
		clearSettleTimers();
		if (props.room.getCurrentThreadId() === props.topicId) {
			props.room.setCurrentThreadId(undefined);
		}
	});

	async function changeTopic() {
		clearSettleTimers();
		sortRanks.value = null;
		knownCommentIds.clear();
		commentsSeeded = false;
		props.room.setCurrentThreadId(props.topicId);
		await getThreadEvents();
	}

	async function getThreadEvents() {
		loadingEvents.value = true;
		const events = await props.room.getCurrentThreadEvents();
		threadEvents.splice(0, threadEvents.length, ...events);
		loadingEvents.value = false;
		revealOwnNewComment();
	}

	/**
	 * A top-level comment you just wrote is appended at the very bottom of the list, out of sight,
	 * so take the reader there and highlight it. A reply lands as the first child of the comment it
	 * answers, which is the comment you were already looking at, so it needs no jump. Local echoes
	 * are skipped: they carry a temporary event id that is swapped for the real one moments later,
	 * which would otherwise scroll and highlight the same comment twice.
	 */
	function revealOwnNewComment() {
		const settled = comments.value.filter((comment) => comment.matrixEvent.status === null);
		const mine = settled.filter((comment) => !knownCommentIds.has(comment.matrixEvent.getId()!) && comment.matrixEvent.getSender() === user.userId);
		const isFirstLoad = !commentsSeeded;

		settled.forEach((comment) => knownCommentIds.add(comment.matrixEvent.getId()!));
		commentsSeeded = true;

		// On opening the post every comment is new; only later arrivals are worth jumping to
		if (isFirstLoad) return;

		const newest = mine.filter((comment) => !parentCommentId(comment)).pop();
		if (!newest) return;

		nextTick(() => scrollToComment(newest.matrixEvent.getId()!));
	}

	function backToFeed() {
		sidebar.close();
		router.push({ name: 'room', params: { id: props.room.roomId } });
	}

	function scrollToComment(eventId: string) {
		const elEvent = elPostView.value?.querySelector(`[id="${eventId}"]`);
		if (!elEvent) return;
		elEvent.scrollIntoView({ block: 'center' });
		elEvent.classList.add('highlighted');
		window.setTimeout(() => {
			elEvent.classList.add('unhighlighted');
			window.setTimeout(() => {
				elEvent.classList.remove('highlighted');
			}, 500);
		}, 2000);
	}

	function confirmDeleteMessage(event: TMessageEvent) {
		eventToBeDeleted.value = event;
		showConfirmDelMsgDialog.value = true;
	}

	async function deleteMessage(event: TMessageEvent, reason?: string) {
		showConfirmDelMsgDialog.value = false;
		if (event.event_id === props.topicId) {
			// Deleting the post itself: redact and return to the feed
			await pubhubs.deleteMessage(props.room.roomId, event.event_id, undefined, undefined, reason);
			backToFeed();
			return;
		}
		props.room.deleteThreadMessage(event, props.topicId, reason);
	}

	function toggleReactionPanel(eventId: string) {
		activeReactionPanel.value = activeReactionPanel.value === eventId ? null : eventId;
	}

	function closeReactionPanel() {
		activeReactionPanel.value = null;
	}

	async function sendEmoji(emoji: string, eventId: string) {
		await pubhubs.addReactEvent(props.room.roomId, eventId, emoji);
	}
</script>

<style scoped>
	.comments-move {
		transition: transform 0.4s ease;
	}
</style>
