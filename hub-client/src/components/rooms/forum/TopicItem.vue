<template>
	<div ref="rootEvt" :id="topic.eventId" class="bg-surface m-5 space-y-1 rounded-xl px-4 py-2">
		<div class="mb-2 flex flex-row">
			<!-- Avatar -->
			<div class="flex-shrink-0">
				<AvatarId v-if="roomMember" :userId="roomMember.userId"></AvatarId>
			</div>

			<!-- Main content: vertical stack -->
			<div class="ml-2 flex min-w-0 flex-grow flex-col">
				<!-- Top row: Name + Dots -->
				<div class="flex items-center justify-between">
					<span class="truncate text-base font-semibold">
						<UserDisplayName :userId="topic.author?.userId!" :userDisplayName="topic.author?.displayName"></UserDisplayName>
					</span>
					<div class="ml-2 flex-shrink-0">
						<DotsMenu
							:show-close="currentUserIsTopicAuthor && !props.topic.closed && !props.replies"
							:show-open="currentUserIsTopicAuthor && props.topic.closed && !props.replies"
							:show-menu="isActiveDots"
							:show-delete="currentUserIsTopicAuthor"
							:show-edit="currentUserIsTopicAuthor"
							@click.capture="toggleDots(topic.eventId)"
							@pointerenter="
								(event: PointerEvent) => {
									event.pointerType === 'mouse' && openDots(topic.eventId);
								}
							"
							@pointerleave="
								(event: PointerEvent) => {
									event.pointerType === 'mouse' && closeDots();
								}
							"
							@close="
								() => {
									closeOrOpenTopic(true);
									closeDots();
								}
							"
							@open="
								() => {
									closeOrOpenTopic(false);
									closeDots();
								}
							"
							@delete="OnDeleteClick"
							@report="closeDots"
							@edit="
								() => {
									closeDots();
									toggleEdit(topic.eventId);
								}
							"
						/>
					</div>
				</div>

				<!-- Second row: Date -->
				<span class="mx-1 inline-block" style="margin-top: 1px">
					<span class="flex gap-x-1">
						<EventTime :timestamp="topic.timestamp" :showDate="false" />
						<span class="text-lg font-normal">|</span>
						<EventTime :timestamp="topic.timestamp" :showDate="true" />
					</span>
				</span>

				<!-- Third row: In reply to -->
				<div class="mt-1">
					<MessageSnippetForum v-if="replies && isNestedReply" :eventId="nestedRel?.reply_to_event_id!" :room="room" @click="onInReplyToClick(nestedRel?.reply_to_event_id!)" />
				</div>
			</div>
		</div>

		<EditTopicInput
			v-if="isEditTopic"
			:topic="topic"
			:reply="replies ?? false"
			:room="room"
			:main-topic="mainTopic"
			@submit="
				() => {
					closeDots();
					toggleEdit(topic.eventId);
				}
			"
		/>
		<LabelWithDescription show v-else class="space-y-1" description-class="text-black text-justify dark:text-white">
			{{ topic.title }}
			<template #description>
				<div v-if="topic.image || topic.file" class="p-4 pl-0">
					<div class="min-w-40 [&_img:not(.m-auto)]:!w-[40rem]">
						<MessageImage v-if="topic.image" :message="topic.image.content as TImageMessageEventContent" class="max-w-[40rem]" />
						<MessageFile v-if="topic.file" :message="topic.file.content as TFileMessageEventContent" class="max-w-[20rem]" />
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
	import DotsMenu from '@hub-client/components/rooms/forum/DotsMenu.vue';
	import EditTopicInput from '@hub-client/components/rooms/forum/EditTopicInput.vue';
	import ForumInput from '@hub-client/components/rooms/forum/ForumInput.vue';
	import LabelWithDescription from '@hub-client/components/rooms/forum/LabelWithDescription.vue';
	import MessageSnippetForum from '@hub-client/components/rooms/forum/MessageSnippetForum.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

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

	import { useDotsState, useEditState, useReplyState } from '@hub-client/stores/forum/ThreadsStore';
	import { useForumStore } from '@hub-client/stores/forum/forumStore';
	import { UserInteraction, useUserInteractionsStore } from '@hub-client/stores/forum/userStore';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	// Stores
	import { User } from '@hub-client/stores/user';

	import Icon from '@hub-client/new-design/components/Icon.vue';

	const showReplies = ref(false);
	const forumStore = useForumStore();
	const pubhubs = usePubhubsStore();
	const userInteractions = useUserInteractionsStore();
	const router = useRouter();

	const { activeReplyTopicKey, toggleReply } = useReplyState();
	const { activeEditTopicKey, toggleEdit } = useEditState();
	const { activeDotsTopicKey, toggleDots, openDots, closeDots } = useDotsState();

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
	const isActiveDots = computed(() => activeDotsTopicKey.value === props.topic.eventId);
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
			if (!reply) return logger.error(SMI.STORE, 'Failed to send reply');

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
			logger.trace(SMI.STORE, 'error in submitting reply', { error });
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
		closeDots();
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

<style lang="css" scoped>
	@keyframes highlight_flashing {
		0% {
			background: none;
		}
		50% {
			background: rgba(80, 80, 80, 0.8);
		}
		100% {
			background: none;
		}
	}
	.highlight_flashing {
		animation: highlight_flashing 1s ease-in-out 3;
	}
</style>
