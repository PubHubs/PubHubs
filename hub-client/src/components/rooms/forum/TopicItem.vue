<template>
	<div ref="rootEvt" :id="topic.eventId" class="bg-surface m-5 space-y-1 rounded-xl px-4 py-2">
		<div class="mb-2 flex flex-row items-center">
			<AvatarId v-if="roomMember" :userId="roomMember.userId"></AvatarId>
			<div class="ml-2 flex grow">
				<div class="flex w-full items-center justify-between gap-2">
					<span class="flex items-center gap-1">
						<UserDisplayName :userId="topic.author?.userId!" :userDisplayName="topic.author?.displayName"></UserDisplayName>
						<EventTime :timestamp="topic.timestamp" :showDate="true" />
						<EventTime :timestamp="topic.timestamp" :showDate="false" />
					</span>

					<div v-if="!isEditTopic" class="ml-2">
						<ActionMenu>
							<ActionMenuItem>Report</ActionMenuItem>
							<ActionMenuItem v-if="currentUserIsTopicAuthor && !props.topic.closed && !props.replies" @click="closeOrOpenTopic(true)">Close</ActionMenuItem>
							<ActionMenuItem v-if="currentUserIsTopicAuthor && props.topic.closed && !props.replies" @click="closeOrOpenTopic(false)">Open</ActionMenuItem>
							<ActionMenuItem v-if="currentUserIsTopicAuthor" @click="OnDeleteClick">Delete</ActionMenuItem>
							<ActionMenuItem v-if="currentUserIsTopicAuthor" @click="toggleEdit(topic.eventId)">Edit</ActionMenuItem>
						</ActionMenu>
					</div>
					<Button v-else icon="x" variant="errorIcon" size="sm" class="-mr-200" @click="toggleEdit(topic.eventId)"></Button>
				</div>

				<!-- In reply to -->
				<div class="mt-1">
					<MessageSnippetForum v-if="replies && isNestedReply" :eventId="nestedRel?.reply_to_event_id!" :room="room" @click="onInReplyToClick(nestedRel?.reply_to_event_id!)" />
				</div>
			</div>
		</div>

		<EditTopicInput v-if="isEditTopic" :topic="topic" :reply="replies ?? false" :room="room" :main-topic="mainTopic" @submit="toggleEdit(topic.eventId)" />
		<LabelWithDescription show v-else class="space-y-1" description-class="text-black text-justify dark:text-white">
			{{ topic.title }}
			<template #description>
				<div v-if="topic.image || topic.file" class="p-4 pl-0">
					<div class="min-w-40">
						<MessageImage v-if="topic.image" :message="topic.image.content" />
						<MessageFile v-if="topic.file" :message="topic.file.content" />
					</div>
				</div>
				{{ topic.body }}
			</template>
		</LabelWithDescription>

		<div class="flex w-full flex-row gap-x-4">
			<div class="flex cursor-pointer flex-row items-center select-none" @click="handleRating(UserInteraction.LIKED)">
				<Icon type="thumbs-up" size="sm" :filled="interaction === UserInteraction.LIKED" :class="interaction === UserInteraction.LIKED ? 'text-green-900' : ''" />
				<span class="ml-1" :class="interaction === UserInteraction.LIKED ? 'text-white' : 'text-gray-light'">{{ localLikes }}</span>
			</div>

			<div class="flex cursor-pointer flex-row items-center select-none" @click="handleRating(UserInteraction.DISLIKED)">
				<Icon type="thumbs-down" size="sm" :filled="interaction === UserInteraction.DISLIKED" :class="interaction === UserInteraction.DISLIKED ? 'text-red-900' : ''" />
				<span class="ml-1" :class="interaction === UserInteraction.DISLIKED ? 'text-white' : 'text-gray-light'">{{ localDisikes }}</span>
			</div>

			<span v-if="mainTopic.closed === false" class="ml-1 cursor-pointer select-none" :class="isActiveReplyTopic ? 'text-white' : 'text-gray-light'" @click="toggleReply(topic.eventId)">Reply</span>

			<div v-if="replies && localReplies.length !== 0" class="flex cursor-pointer flex-row items-center select-none" @click="showReplies = !showReplies">
				<Icon type="chat-circle-text" size="sm" :class="showReplies ? '' : 'text-gray-light'" />
				<span class="mr-1 ml-1" :class="showReplies ? '' : 'text-gray-light'">{{ localReplies.length }}</span>
				<Icon :type="showReplies ? 'arrow-down' : 'arrow-up'" size="sm" :class="showReplies ? '' : 'text-gray-light'" />
			</div>
		</div>
	</div>

	<ForumInput v-if="isActiveReplyTopic" class="m-5" :min_length="REPLY_MIN_LENGTH" :max_length="REPLY_MAX_LENGTH" @submit="submitReply" />

	<!-- Recursion  -->
	<div v-if="showReplies" :class="{ 'ml-20': props.depth === 0 }">
		<TopicItem v-for="reply in localReplies" :key="reply.eventId" :topic="reply" :main-topic="topic" :room="room" :current-user="currentUser" :replies="true" :depth="props.depth + 1" />
	</div>
	<InlineSpinner v-if="isSubmitting"></InlineSpinner>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useRouter } from 'vue-router';

	// Components
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import MessageFile from '@hub-client/components/rooms/MessageFile.vue';
	import MessageImage from '@hub-client/components/rooms/MessageImage.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import EditTopicInput from '@hub-client/components/rooms/forum/EditTopicInput.vue';
	import ForumInput from '@hub-client/components/rooms/forum/ForumInput.vue';
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import MessageSnippetForum from '@hub-client/components/rooms/forum/MessageSnippetForum.vue';
	import ActionMenu from '@hub-client/components/ui/ActionMenu.vue';
	import ActionMenuItem from '@hub-client/components/ui/ActionMenuItem.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	import { LOGGER } from '@hub-client/logic/logging/Logger';
	// Logic
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	import { TFileMessageEventContent, TImageMessageEventContent, TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';
	import { TThread } from '@hub-client/models/events/forum/TThread';
	import { TTopicReplyContent } from '@hub-client/models/events/forum/TTopicEvent';
	// Models
	import Room from '@hub-client/models/rooms/Room';

	import { createDummyEvent, createDummyFile, createDummyImage } from '@hub-client/services/forum/forumHelpers';
	import { REPLY_MAX_LENGTH, REPLY_MIN_LENGTH } from '@hub-client/services/forum/properties';

	import { useEditState, useReplyState } from '@hub-client/stores/forum/ThreadsStore';
	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { UserInteraction, useUserInteractionsStore } from '@hub-client/stores/forum/userStore';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	// Stores
	import { User } from '@hub-client/stores/user';

	import Button from '@hub-client/new-design/components/Button.vue';
	import Icon from '@hub-client/new-design/components/Icon.vue';

	const showReplies = ref(false);
	const forumStore = useForumStore();
	const pubhubs = usePubhubsStore();
	const userInteractions = useUserInteractionsStore();
	const router = useRouter();

	const { activeReplyTopicKey, toggleReply } = useReplyState();
	const { activeEditTopicKey, toggleEdit } = useEditState();

	type Props = {
		topic: TThread;
		room: Room;
		currentUser: User;
		mainTopic: TThread;
		replies?: boolean;
		depth?: number;
	};

	const props = withDefaults(defineProps<Props>(), {
		replies: false,
		depth: 0,
	});

	const isSubmitting = ref(false);
	const localLikes = ref(props.topic.likes);
	const localDisikes = ref(props.topic.dislikes);
	const nestedReplyContent = ref<TTopicReplyContent>();
	const localReplies = computed(() => props.topic.replies);

	const interaction = computed(() => userInteractions.get(props.topic.eventId));
	const isActiveReplyTopic = computed(() => activeReplyTopicKey.value === props.topic.eventId);
	const isEditTopic = computed(() => activeEditTopicKey.value === props.topic.eventId);
	const currentUserIsTopicAuthor = computed(() => props.currentUser?.userId === props.topic.author?.userId);

	const roomMember = computed(() => {
		if (props.room && props.topic.author?.userId) {
			return props.room.getMember(props.topic.author?.userId!, true);
		}
		return null;
	});

	watch(
		() => props.topic.likes,
		(newVal) => {
			localLikes.value = newVal;
		},
		{ immediate: true },
	);

	watch(
		() => props.topic.dislikes,
		(newVal) => {
			localDisikes.value = newVal;
		},
		{ immediate: true },
	);

	onMounted(async () => {
		const evt = await pubhubs.getEvent(props.room.roomId, props.topic.eventId);
		nestedReplyContent.value = evt.content as TTopicReplyContent;
	});

	const nestedRel = computed(() => nestedReplyContent.value?.['m.relates_to']?.['m.in_reply_to']);
	const isNestedReply = computed(() => {
		if (!nestedRel.value) {
			return false;
		}

		const mainEventId = nestedRel.value.main_event_id;
		const replyToId = nestedRel.value.reply_to_event_id;

		if (!mainEventId || !replyToId) {
			return false;
		}

		if (mainEventId !== replyToId) {
			return true;
		}

		return false;
	});

	if (props.currentUser.userId) {
		const currentRating = forumStore.getRatingUser(props.topic.eventId, props.currentUser.userId);

		if (currentRating == 'like') {
			userInteractions.like(props.topic.eventId);
		} else if (currentRating == 'dislike') {
			userInteractions.dislike(props.topic.eventId);
		}
		// no action required if it is neither liked nor disliked
	}

	const handleRating = (target: UserInteraction) => {
		const currentRating = userInteractions.get(props.topic.eventId);
		userInteractions.toggleInteraction(props.topic.eventId, interaction.value, target);
		if (interaction.value == 1) {
			// send like
			forumStore.sendRating(props.topic.eventId, 'like');
			localLikes.value++;
		} else if (interaction.value == 2) {
			// send dislike
			forumStore.sendRating(props.topic.eventId, 'dislike');
			localDisikes.value++;
		} else {
			// send neutral message
			forumStore.sendRating(props.topic.eventId, 'none');
		}
		if (currentRating == 1) localLikes.value--;
		else if (currentRating == 2) localDisikes.value--;
	};

	async function submitReply(payload: { text: string; image: TLocalAttachmentMessageEventContent | null; file: TLocalAttachmentMessageEventContent | null }) {
		try {
			isSubmitting.value = true;
			const { text, image, file } = payload;
			const reply = await forumStore.sendReply(props.topic.eventId, text);
			toggleReply(props.topic.eventId);
			if (!reply) return LOGGER.error(SMI.STORE, 'Failed to send reply');

			let dummyImage: TMessageEvent<TImageMessageEventContent> | undefined;
			let dummyFile: TMessageEvent<TFileMessageEventContent> | undefined;
			if (file) {
				const fileResult = await forumStore.sendAttachment(file, reply.event_id);
				dummyFile = createDummyFile(fileResult.id, fileResult.url, file);
			}

			if (image) {
				const imageResult = await forumStore.sendAttachment(image, reply.event_id);
				dummyImage = createDummyImage(imageResult.id, imageResult.url, image);
			}

			// wrap local image/file into dummy TMessageEvent<…>
			const newReply: TThread = createDummyEvent(false, reply.event_id, text, undefined, props.currentUser, dummyImage, dummyFile);
			forumStore.addReplyToTopic(props.topic.eventId, newReply);

			if (props.replies) showReplies.value = true;
		} catch (error) {
			LOGGER.trace(SMI.STORE, 'error in submitting reply', { error });
		} finally {
			isSubmitting.value = false;
		}
	}

	function onInReplyToClick(eventId: string) {
		const element = document.getElementById(eventId);
		if (!element) return;
		element.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'center',
		});
		element.classList.add('highlight_flashing');
		setTimeout(() => element.classList.remove('highlight_flashing'), 1000 * 3);
	}

	function OnDeleteClick() {
		if (props.replies) {
			forumStore.deleteTopicReply(props.topic);
		} else {
			forumStore.deleteTopic(props.topic);
			router.push({ name: 'room', params: { id: props.room.roomId } });
		}
	}

	async function closeOrOpenTopic(closed: boolean) {
		isSubmitting.value = true;
		await forumStore.sendTopic(props.topic.title, props.topic.body, closed, props.topic.eventId, props.topic.title, props.topic.body, props.topic.closed);
		const t = forumStore.findThreadByEventId(props.topic.eventId);
		if (t) {
			t.closed = closed;
		}
		isSubmitting.value = false;
	}
</script>
