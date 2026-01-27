<template>
	<div ref="elReactionPopUp" @contextmenu="openMenu($event, getContextMenuItems(), props.event.event_id)">
		<div class="group flex flex-col py-3" :class="getMessageContainerClasses" role="article">
			<!-- Announcement Header -->
			<div v-if="isAnnouncementMessage && !redactedMessage" class="bg-surface-high text-label-small flex w-full items-center px-8 py-1" :class="{ 'mx-4': props.deleteMessageDialog }">
				<Icon type="megaphone-simple" size="sm" class="mr-1"></Icon>
				{{ getAnnouncementTitle }}
			</div>

			<!-- Message Container -->
			<div class="relative flex w-full gap-2 px-6" :class="getMessageContainerClasses">
				<!-- Reaction Panel -->
				<div v-if="showReactionPanel" :class="['absolute right-0 bottom-full z-50', calculatePanelPlacement() ? 'bottom-full' : 'top-8']">
					<ReactionMiniPopUp :eventId="props.event.event_id" :room="room" @emoji-selected="emit('clickedEmoticon', $event, props.event.event_id)" @close-panel="emit('reactionPanelClose')" />
				</div>

				<!-- Avatar -->
				<Avatar
					:avatar-url="user.userAvatar(props.event.sender)"
					:user-id="props.event.sender"
					@click.stop="emit('profileCardToggle', props.event.event_id)"
					:class="['transition-all duration-500 ease-in-out', { 'ring-on-surface-dim cursor-pointer ring-1 ring-offset-4': hover || props.activeProfileCard === props.event.event_id }]"
					@mouseover="hover = true"
					@mouseleave="hover = false"
					@contextmenu="openMenu($event, props.event.sender !== user.userId ? [{ label: 'Direct message', icon: 'chat-circle', onClick: () => user.goToUserRoom(props.event.sender) }] : [])"
				/>

				<!-- Profile Card -->
				<div class="relative">
					<Popover v-if="showProfileCard" @close="emit('profileCardClose')" :class="['absolute z-50 h-40 w-52', profileInPosition(props.event) ? 'bottom-4' : '']">
						<ProfileCard :event="props.event" :room="room" :room-member="roomMember" />
					</Popover>
				</div>

				<!-- Message and Actions -->
				<div :class="{ 'w-5/6': deleteMessageDialog, 'w-full': !deleteMessageDialog }" class="min-w-0">
					<div class="flex flex-wrap items-center overflow-hidden text-wrap break-all">
						<div class="relative flex min-h-6 w-full items-start gap-x-2 pb-1">
							<div class="flex w-full min-w-0 grow flex-wrap items-center gap-2">
								<UserDisplayName :userId="props.event.sender" :userDisplayName="user.userDisplayName(props.event.sender)" />
								<span class="flex gap-2">
									<span class="text-label-small">|</span>
									<EventTime :timestamp="props.event.origin_server_ts" :showDate="false" />
									<span class="text-label-small">|</span>
									<EventTime :timestamp="props.event.origin_server_ts" :showDate="true" />
								</span>
								<RoomBadge v-if="!room.directMessageRoom()" class="inline-block" :user="props.event.sender" :room_id="props.event.room_id" />
							</div>
						</div>
					</div>

					<Suspense>
						<MessageSnippet v-if="showReplySnippet(props.event.content.msgtype)" @click="onInReplyToClick" :eventId="inReplyToId" :showInReplyTo="true" :room="room" />
						<template #fallback>
							<div class="flex items-center gap-3 rounded-md px-2">
								<p>{{ t('state.loading_message') }}</p>
							</div>
						</template>
					</Suspense>

					<Message :event="props.event" :deleted="redactedMessage" />
					<AnnouncementMessage v-if="isAnnouncementMessage && !redactedMessage && !room.isPrivateRoom()" :event="props.event.content" />
					<MessageSigned v-if="props.event.content.msgtype === PubHubsMgType.SignedMessage && !redactedMessage" :message="props.event.content.signed_message" class="max-w-[90ch]" />
					<MessageFile v-if="props.event.content.msgtype === MsgType.File && !redactedMessage" :message="props.event.content" />
					<MessageImage v-if="props.event.content.msgtype === MsgType.Image && !redactedMessage" :message="props.event.content" />
					<MessageDisclosureRequest v-if="props.event.content.msgtype === PubHubsMgType.AskDisclosureMessage" :event="props.event" class="flex flex-col" />
					<MessageDisclosed v-if="props.event.content.msgtype === PubHubsMgType.DisclosedMessage && !redactedMessage" :message="props.event.content.signed_message" class="max-w-[90ch]" />
					<VotingWidget
						v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && props.event.content.msgtype === PubHubsMgType.VotingWidget && !redactedMessage"
						:room="room"
						:event="props.event"
						@edit-poll="(poll, eventId) => emit('editPoll', poll, eventId)"
						@edit-scheduler="(scheduler, eventId) => emit('editScheduler', scheduler, eventId)"
					/>

					<div class="mt-4 flex h-4 items-center justify-end gap-4">
						<!-- Thread View Button -->
						<button
							@click="replyInThread"
							class="text-label-tiny inline-flex gap-1 rounded-md hover:cursor-pointer hover:opacity-80"
							v-if="!deleteMessageDialog && !viewFromThread && threadLength > 0 && canReplyInThread && !msgIsNotSend && !redactedMessage"
						>
							{{ t('message.threads.view_thread') }}
							<Icon type="chat-circle" size="sm" />
						</button>

						<!-- Message Action Buttons -->
						<div class="h-fit w-fit">
							<template v-if="timerReady && !deleteMessageDialog">
								<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="mb-1 ml-2" :title="t('errors.resend')">
									<Icon type="arrow-counter-clockwise" size="sm" class="text-red" />
								</button>
								<Icon v-if="msgIsNotSend && !connection.isOn" type="wifi-slash" size="sm" class="text-red mb-1 ml-2" />
							</template>

							<RoomEventActionsPopup v-if="!deleteMessageDialog" :remain-active="openEmojiPanel" :class="!isMobile ? 'hidden group-hover:block' : 'block'">
								<!-- Uncomment once issue is resolved -->
								<!-- <div v-if="isSupported">
										<button
											@click="copy(`${source}?eventid=${event.event_id}`)"
											class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out w-fit h-fit"
										>
											<Icon type="link" size="sm" v-if="!copied"></Icon>
											<Icon type="check" size="sm" v-else>Copied!</Icon>
										</button>
									</div> -->
								<!-- Reaction Button -->
								<button
									v-if="!redactedMessage"
									@click.stop="emit('reactionPanelToggle', props.event.event_id)"
									class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex h-fit w-fit items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
									:title="t('message.reply_emoji')"
								>
									<Icon type="smiley" size="sm"></Icon>
								</button>

								<!-- Reply Button -->
								<button
									v-if="!msgIsNotSend && !redactedMessage && !isThreadRoot"
									@click="reply"
									class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex h-fit w-fit items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
									:title="t('message.reply')"
								>
									<Icon type="arrow-bend-up-left" size="sm" />
								</button>

								<!-- Thread Reply Button -->
								<button
									v-if="!viewFromThread && threadLength <= 0 && canReplyInThread && !msgIsNotSend && !redactedMessage"
									@click="replyInThread"
									class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex h-fit w-fit items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
									:title="t('message.reply_in_thread')"
								>
									<Icon type="chat-circle" size="sm"></Icon>
								</button>

								<!-- Disclosure Button -->
								<button
									v-if="!msgIsNotSend && user.isAdmin && event.sender !== user.userId && settings.isFeatureEnabled(FeatureFlag.disclosure)"
									@click="router.push({ name: 'ask-disclosure', query: { user: event.sender } })"
									class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex h-fit w-fit items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
									:title="t('menu.moderation_tools_disclosure')"
								>
									<Icon type="warning" size="sm" />
								</button>

								<!-- Delete Button -->
								<button
									v-if="settings.isFeatureEnabled(FeatureFlag.deleteMessages) && !msgIsNotSend && event.sender === user.userId && !redactedMessage && !(props.viewFromThread && isThreadRoot)"
									@click="onDeleteMessage(event)"
									class="text-on-surface-variant hover:bg-accent-red hover:text-on-accent-red flex h-fit w-fit items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:cursor-pointer"
									:title="t('menu.delete_message')"
								>
									<Icon type="trash" size="sm" />
								</button>
							</RoomEventActionsPopup>
						</div>
					</div>
				</div>
			</div>

			<!-- Reactions Slot -->
			<div>
				<slot name="reactions"></slot>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import MessageDisclosed from './MessageDisclosed.vue';
	import MessageDisclosureRequest from './MessageDisclosureRequest.vue';
	import { useClipboard } from '@vueuse/core';
	import { IEvent, MsgType } from 'matrix-js-sdk';
	import { PropType, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AnnouncementMessage from '@hub-client/components/rooms/AnnouncementMessage.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import Message from '@hub-client/components/rooms/Message.vue';
	import MessageFile from '@hub-client/components/rooms/MessageFile.vue';
	import MessageImage from '@hub-client/components/rooms/MessageImage.vue';
	import MessageSigned from '@hub-client/components/rooms/MessageSigned.vue';
	import MessageSnippet from '@hub-client/components/rooms/MessageSnippet.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import RoomEventActionsPopup from '@hub-client/components/rooms/RoomEventActionsPopup.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import VotingWidget from '@hub-client/components/rooms/voting/VotingWidget.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import Popover from '@hub-client/components/ui/Popover.vue';
	import ProfileCard from '@hub-client/components/ui/ProfileCard.vue';
	import ReactionMiniPopUp from '@hub-client/components/ui/ReactionMiniPopUp.vue';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import { router } from '@hub-client/logic/core/router';
	import { CONFIG } from '@hub-client/logic/logging/Config';

	// Models
	import { RelationType } from '@hub-client/models/constants';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';

	// Stores
	import { useConnection } from '@hub-client/stores/connection';
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { MenuItem, useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const contextMenuStore = useContextMenuStore();
	const { openMenu } = useContextMenu();
	const connection = useConnection();
	const messageActions = useMessageActions();
	const pubhubs = usePubhubsStore();
	const user = useUser();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const { t } = useI18n();
	const hover = ref(false);
	const openEmojiPanel = ref(false);
	const elReactionPopUp = ref<HTMLElement | null>(null);
	const source = ref('');
	const { text, copy, copied, isSupported } = useClipboard({ source });
	const isMobile = computed(() => settings.isMobileState);

	let roomMember = ref();
	let threadLength = ref(0);

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
		eventThreadLength: {
			type: Number,
			default: 0,
		},
		room: {
			type: Room,
			required: true,
		},
		viewFromThread: {
			type: Boolean,
			default: false,
		},
		deletedEvent: {
			type: Boolean,
		},
		deleteMessageDialog: {
			type: Boolean,
			default: false,
		},
		activeProfileCard: {
			type: String as PropType<string | null>,
			default: null,
		},
		activeReactionPanel: {
			type: String as PropType<string | null>,
			default: null,
		},
	});

	// Set the ref variable to the url to be shared.

	// ${baseUrl}#/hub/${hubName}/${roomId}

	onMounted(() => {
		source.value = `${CONFIG._env.PARENT_URL}#/hub/${hubSettings.hubName}/${props.room.roomId}`;
		threadLength.value = props.eventThreadLength;
	});

	onBeforeUnmount(() => {
		// If the profile card is open when this component is unmounted, close it.
		if (props.activeProfileCard === props.event.event_id) {
			emit('profileCardClose');
		}
	});

	/**
	 * Watch the threadUpdated for new events coming from slidingsync
	 */
	watch(
		() => props.room.threadUpdated,
		() => {
			if (props.event.event_id === props.room.currentThread?.rootEvent?.event.event_id) {
				threadLength.value = (props.room.currentThread?.rootEvent?.getThread()?.length ?? 0) + 1; // length does not include rootEvent
			}
		},
	);

	const inReplyToId = props.event.content[RelationType.RelatesTo]?.[RelationType.InReplyTo]?.event_id;

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
		(e: 'deleteMessage', event: TMessageEvent): void;
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
		(e: 'profileCardToggle', eventId: string): void;
		(e: 'profileCardClose'): void;
		(e: 'reactionPanelToggle', eventId: string): void;
		(e: 'reactionPanelClose'): void;
		(e: 'clickedEmoticon', emoji: string, eventId: string): void;
	}>();

	const showProfileCard = computed(() => props.activeProfileCard === props.event.event_id);

	const showReactionPanel = computed(() => props.activeReactionPanel === props.event.event_id);

	const msgIsNotSend = computed(() => props.event.event_id.substring(0, 1) === '~');

	const canReplyInThread = computed(() => !props.event.content[RelationType.RelatesTo]);

	const isThreadRoot = computed(() => props.room.currentThread?.threadId === props.event.event_id);

	const containsRedactedBecause = props.event.unsigned?.redacted_because !== undefined;

	const redactedMessage = computed(() => {
		return props.deletedEvent || containsRedactedBecause;
	});

	const isAnnouncementMessage = computed(() => props.event.content.msgtype === PubHubsMgType.AnnouncementMessage);

	const getAnnouncementTitle = computed(() => getUserTitleForAnnouncement(props.event.sender));

	// Styling of the event based on announcment message
	const getMessageContainerClasses = computed(() => {
		// Base classes
		const baseClasses = {
			'p-2 transition-all duration-150 ease-in-out hover:bg-surface-low': !props.deleteMessageDialog,
			'mx-4 rounded-xs shadow-[0_0_5px_0_rgba(0,0,0,0.3)]': props.deleteMessageDialog,
			'rounded-t-none': isAnnouncementMessage.value,
			'!bg-surface-low': contextMenuStore.isOpen && contextMenuStore.currentTargetId == props.event.event_id,
		};

		// Return base classes if not an announcement or is redacted
		if (!isAnnouncementMessage.value || redactedMessage.value) {
			return baseClasses;
		}

		// Common announcement classes
		const commonAnnouncementClasses = {
			'bg-surface-low': true,
		};

		return {
			...baseClasses,
			...commonAnnouncementClasses,
		};
	});

	/**
	 * Determines the announcement title based on user power level
	 * - Power level 50 = Steward
	 * - Power level 100 = Room Administrator
	 */
	function getUserTitleForAnnouncement(userId: string): string {
		const powerLevel = props.room.getPowerLevel(userId);
		if (powerLevel >= 50 && powerLevel < 100) return announcementTitle(t('rooms.steward'));
		else if (powerLevel === 100) return announcementTitle(t('rooms.administrator'));
		else return ''; // empty title will not display anything.
	}

	function announcementTitle(role: string): string {
		return t('rooms.room') + ' ' + role + ' ' + t('rooms.announcement');
	}

	/**
	 * Returns boolean whether the reply snippet can be shown
	 * When in a thread: images and files always get an reply, so it is not clear if they are meant to be a reply.
	 * Like Element we remove the replysnippet in that case.
	 */
	function showReplySnippet(msgType: string): boolean {
		if (props.viewFromThread) {
			if (msgType === MsgType.Image || msgType === MsgType.File) {
				return false;
			}
		}
		return !!inReplyToId && !redactedMessage.value;
	}

	function onInReplyToClick() {
		if (!inReplyToId) return;
		emit('inReplyToClick', inReplyToId);
	}

	function onDeleteMessage(event: TMessageEvent) {
		emit('deleteMessage', event);
	}

	function reply() {
		messageActions.replyingTo = props.event.event_id;
	}

	function replyInThread() {
		props.room.setCurrentThreadId(props.event.event_id);
	}

	function resend() {
		pubhubs.resendEvent(props.event);
	}

	function profileInPosition(ev: Partial<IEvent>) {
		return ev.event_id === props.room.getLastVisibleEventId() && props.room.numOfMessages() > 5;
	}

	// Positions the panel based on whether the message event is near the bottom of the screen
	// or near the top.
	function calculatePanelPlacement(): boolean {
		const position = elReactionPopUp.value?.getBoundingClientRect();
		if (!position) return false;
		// If the top of the bubble is below the middle of the viewport, open upwards
		return position.top > window.innerHeight / 2;
	}

	// Waits for checking if message is realy send. Otherwise a 'resend' button appears. See also msgIsNotSend computed.
	const timerReady = ref(false);
	globalThis.setTimeout(() => {
		timerReady.value = true;
	}, 1000);

	function getContextMenuItems() {
		const menu: MenuItem[] = [];

		// Direct message (only if sender is not current user)
		if (props.event.sender !== user.userId) {
			menu.push({
				label: 'Direct message',
				icon: 'chat-circle',
				onClick: () => user.goToUserRoom(props.event.sender),
			});
		}

		// Reaction
		if (!props.event.redactedMessage) {
			menu.push({
				label: 'Add reaction',
				icon: 'smiley',
				onClick: () => emit('reactionPanelToggle', props.event.event_id),
			});
		}

		// Reply
		if (!props.event.msgIsNotSend && !props.event.redactedMessage && !props.event.isThreadRoot) {
			menu.push({
				label: 'Reply',
				icon: 'arrow-bend-up-left',
				onClick: () => reply(),
			});
		}

		// Thread reply
		if (!props.viewFromThread && props.eventThreadLength <= 0 && canReplyInThread && !props.event.msgIsNotSend && !props.event.redactedMessage) {
			menu.push({
				label: 'Reply in thread',
				icon: 'chat-circle',
				onClick: () => replyInThread(),
			});
		}

		// Delete (only your own messages)
		if (settings.isFeatureEnabled(FeatureFlag.deleteMessages) && !props.event.msgIsNotSend && props.event.sender === user.userId && !props.event.redactedMessage && !(props.viewFromThread && props.event.isThreadRoot)) {
			menu.push({
				label: 'Delete message',
				icon: 'trash',
				isDelicate: true,
				onClick: () => onDeleteMessage(props.event),
			});
		}

		return menu;
	}
</script>
