<template>
	<div ref="messageRoot" v-context-menu="(evt: any) => openMenu(evt, getContextMenuItems(), props.event.event_id)">
		<div
			ref="elReactionPopUp"
			class="group hover:bg-surface-low flex flex-col"
			:class="[
				props.isGrouped ? 'pt-1!' : 'pt-4!',
				props.isFollowedByGrouped ? 'pb-1!' : 'pb-4!',
				getMessageContainerClasses,
				isAnnouncementMessage && !redactedMessage && 'border-y-on-surface-disabled border-y border-l-4',
				isAnnouncementMessage && !redactedMessage && props.room.getPowerLevel(props.event.sender) === 100 ? 'border-accent-admin' : props.room.getPowerLevel(props.event.sender) >= 50 && 'border-accent-steward',
			]"
			role="article"
		>
			<!-- Message Container -->
			<div class="relative flex w-full gap-4 py-0!" :class="[getMessageContainerClasses, isMobile ? 'px-2' : 'px-5']">
				<!-- Reaction Panel -->
				<div v-if="showReactionPanel && hasBeenVisible" :class="['absolute right-0 bottom-full z-50', calculatePanelPlacement() ? 'bottom-full' : 'top-8']">
					<ReactionMiniPopUp :eventId="props.event.event_id" :room="room" @emoji-selected="emit('clickedEmoticon', $event, props.event.event_id)" @close-panel="emit('reactionPanelClose')" />
				</div>

				<!-- Avatar -->
				<Avatar
					v-if="!props.isGrouped && hasBeenVisible"
					:class="props.room.getPowerLevel(props.event.sender) === 100 ? 'ring-accent-admin/75 ring-2' : props.room.getPowerLevel(props.event.sender) >= 50 && 'ring-accent-steward/75 ring-2'"
					:avatar-url="user.userAvatar(props.event.sender)"
					:user-id="props.event.sender"
					@mouseover="hover = true"
					@mouseleave="hover = false"
				/>

				<!-- Avatar placeholder -->
				<div v-else-if="!props.isGrouped" class="bg-surface-low flex aspect-square h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full"></div>

				<!-- Grouped spacer with hover time -->
				<div v-else class="flex w-12 shrink-0 items-center justify-center">
					<EventTime :timestamp="props.event.origin_server_ts" :showDate="false" class="text-on-surface-dim hidden text-[10px] group-hover:block" />
				</div>

				<!-- Message and Actions -->
				<div :class="{ 'w-5/6': deleteMessageDialog, 'w-full': !deleteMessageDialog }" class="min-w-0">
					<div class="flex flex-wrap items-center overflow-hidden text-wrap break-all">
						<!-- Message Snippet -->
						<Suspense v-if="hasBeenVisible">
							<MessageSnippet v-if="showReplySnippet(props.event.content.msgtype)" @click="onInReplyToClick" :eventId="inReplyToId" class="mb-2" :showInReplyTo="true" :room="room" />
							<template #fallback>
								<div class="flex items-center gap-3 rounded-md px-2">
									<p>{{ t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>

						<div v-if="!props.isGrouped" class="mb-2 flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
							<UserDisplayName :userId="props.event.sender" :userDisplayName="user.userDisplayName(props.event.sender)" />

							<RoomBadge v-if="hasBeenVisible && !room.isDirectMessageRoom()" class="inline-block" :user="props.event.sender" :room_id="props.event.room_id ?? room.roomId" />

							<!-- Announcement -->
							<span
								v-if="isAnnouncementMessage && !redactedMessage"
								class="flex items-center gap-1"
								:class="props.room.getPowerLevel(props.event.sender) === 100 ? 'text-accent-admin' : props.room.getPowerLevel(props.event.sender) >= 50 && 'text-accent-steward'"
							>
								<span class="text-label-tiny pt-025 uppercase">{{ t('rooms.announcement') }}</span>
							</span>

							<span class="text-label-tiny text-on-surface-dim flex gap-1">
								<EventTime :timestamp="props.event.origin_server_ts" :showDate="true" />
								<EventTime :timestamp="props.event.origin_server_ts" :showDate="false" />
							</span>
						</div>
					</div>

					<div class="relative">
						<Message :event="props.event" :deleted="redactedMessage" />

						<!-- Message Action Buttons -->
						<div class="bg-surface absolute right-0 flex rounded-md" :class="actionButtonPosition">
							<template v-if="timerReady && !deleteMessageDialog">
								<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="mb-1 ml-2" :title="t('errors.resend')">
									<Icon type="arrow-counter-clockwise" size="sm" class="text-red" />
								</button>
								<Icon v-if="msgIsNotSend && !connection.isOn" type="wifi-slash" size="sm" class="text-red mb-1 ml-2" />
							</template>

							<!-- <div v-if="isSupported">
								<button
									@click="copy(`${source}?eventid=${props.event.event_id}`)"
									class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary flex items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:w-fit"
								>
									<Icon type="link" v-if="!copied"></Icon>
									<Icon type="check" v-else>Copied!</Icon>
								</button>
							</div> -->

							<!-- Reaction Button -->
							<button
								v-if="!redactedMessage && !isThreadRoot"
								@click.stop="emit('reactionPanelToggle', props.event.event_id)"
								class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary hidden items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.reply_emoji')"
							>
								<Icon type="smiley" />
							</button>

							<!-- Reply Button -->
							<button
								v-if="!msgIsNotSend && !redactedMessage && !isThreadRoot"
								@click="reply"
								class="text-on-surface-variant hover:bg-accent-primary hover:text-on-accent-primary hidden items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.reply')"
							>
								<Icon type="arrow-bend-up-left" />
							</button>

							<!-- Thread Reply Button -->
							<button
								v-if="!deleteMessageDialog && !viewFromThread && eventThreadLength > 0 && canReplyInThread && !msgIsNotSend && !redactedMessage"
								@click="replyInThread"
								class="text-on-surface-variant items-center justify-center rounded-md p-1 transition-all duration-300 ease-in-out hover:w-fit hover:cursor-pointer"
								:class="eventThreadLength > 0 ? 'hover:bg-accent-primary hover:text-on-accent-primary flex items-center justify-center' : 'hover:bg-accent-primary hover:text-on-accent-primary hidden group-hover:flex'"
								:title="t('message.reply_in_thread')"
							>
								<span v-if="eventThreadLength > 0" class="text-label-tiny h-min px-1 group-hover:hidden">{{ eventThreadLength }}</span>
								<Icon type="chat-circle" />
							</button>
						</div>
					</div>

					<!-- Heavy components -->
					<template v-if="hasBeenVisible">
						<AnnouncementMessage v-if="isAnnouncementMessage && !redactedMessage && !DirectRooms.includes(room.getType() as RoomType)" :event="props.event.content" />
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
					</template>
				</div>
			</div>

			<!-- Reactions Slot -->
			<div v-if="hasBeenVisible">
				<slot name="reactions"></slot>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	// import { useClipboard } from '@vueuse/core';
	import { IEvent, MsgType } from 'matrix-js-sdk';
	import { PropType, computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import AnnouncementMessage from '@hub-client/components/rooms/AnnouncementMessage.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import Message from '@hub-client/components/rooms/Message.vue';
	import MessageDisclosed from '@hub-client/components/rooms/MessageDisclosed.vue';
	import MessageDisclosureRequest from '@hub-client/components/rooms/MessageDisclosureRequest.vue';
	import MessageFile from '@hub-client/components/rooms/MessageFile.vue';
	import MessageImage from '@hub-client/components/rooms/MessageImage.vue';
	import MessageSigned from '@hub-client/components/rooms/MessageSigned.vue';
	import MessageSnippet from '@hub-client/components/rooms/MessageSnippet.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import VotingWidget from '@hub-client/components/rooms/voting/VotingWidget.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import ReactionMiniPopUp from '@hub-client/components/ui/ReactionMiniPopUp.vue';

	// Composables
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';
	import { useTimeFormat } from '@hub-client/composables/useTimeFormat';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import { CONFIG } from '@hub-client/logic/logging/Config';

	// Models
	import { RelationType } from '@hub-client/models/constants';
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
	import { Poll, Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import Room from '@hub-client/models/rooms/Room';
	import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';

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
	const sidebar = useSidebar();
	const user = useUser();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const { t } = useI18n();
	const hover = ref(false);
	// const openEmojiPanel = ref(false);
	const elReactionPopUp = ref<HTMLElement | null>(null);
	const source = ref('');

	// const { copy, copied, isSupported } = useClipboard({ source });
	const isMobile = computed(() => settings.isMobileState);
	const { formatTimestamp, formattedTimeInformation } = useTimeFormat();

	// Intersection observer
	const messageRoot = ref<HTMLElement | null>(null);
	const isVisible = ref(false);
	const hasBeenVisible = ref(false);
	let observer: IntersectionObserver | null = null;

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
		isGrouped: {
			type: Boolean,
			default: false,
		},
		isFollowedByGrouped: {
			type: Boolean,
			default: false,
		},
		deleteMessageDialog: {
			type: Boolean,
			default: false,
		},
		activeReactionPanel: {
			type: String as PropType<string | null>,
			default: null,
		},
	});

	onMounted(() => {
		source.value = `${CONFIG._env.PARENT_URL}#/hub/${hubSettings.hubName}/${props.room.roomId}`;

		// Set up intersection observer for lazy rendering
		if (messageRoot.value) {
			observer = new IntersectionObserver(
				(entries) => {
					entries.forEach((entry) => {
						isVisible.value = entry.isIntersecting;
						if (entry.isIntersecting && !hasBeenVisible.value) {
							hasBeenVisible.value = true;
						}
					});
				},
				{
					root: null, // viewport
					rootMargin: '500px', // Start loading 500px before entering viewport
					threshold: 0,
				},
			);
			observer.observe(messageRoot.value);
		}
	});

	onBeforeUnmount(() => {
		// Clean up intersection observer
		if (observer && messageRoot.value) {
			observer.unobserve(messageRoot.value);
			observer.disconnect();
			observer = null;
		}

		// If the profile card is open when this component is unmounted, close it.
		if (props.activeProfileCard === props.event.event_id) {
			emit('profileCardClose');
		}
	});

	const inReplyToId = props.event.content![RelationType.RelatesTo]?.[RelationType.InReplyTo]?.event_id;

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
		(e: 'deleteMessage', event: TMessageEvent): void;
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
		(e: 'reactionPanelToggle', eventId: string): void;
		(e: 'reactionPanelClose'): void;
		(e: 'clickedEmoticon', emoji: string, eventId: string): void;
	}>();

	const showReactionPanel = computed(() => props.activeReactionPanel === props.event.event_id);

	const msgIsNotSend = computed(() => props.event.event_id.substring(0, 1) === '~');

	const canReplyInThread = computed(() => !props.event.content[RelationType.RelatesTo]);

	const isThreadRoot = computed(() => props.room.currentThread?.threadId === props.event.event_id);

	const containsRedactedBecause = props.event.unsigned?.redacted_because !== undefined;

	const redactedMessage = computed(() => {
		return props.deletedEvent || containsRedactedBecause;
	});

	const isAnnouncementMessage = computed(() => props.event.content.msgtype === PubHubsMgType.AnnouncementMessage);

	const isFirstInGroup = computed(() => props.isFollowedByGrouped && !props.isGrouped);
	const isLastInGroup = computed(() => props.isGrouped && !props.isFollowedByGrouped);

	const actionButtonPosition = computed(() => {
		if (isFirstInGroup.value) return 'bottom-0 mb-1';
		if (isLastInGroup.value) return 'top-0 mt-1';
		return 'top-0';
	});

	const getMessageContainerClasses = computed(() => {
		const baseClasses = {
			'p-2 transition-all duration-150 ease-in-out': !props.deleteMessageDialog,
			'mx-4 rounded-xs shadow-[0_0_5px_0_rgba(0,0,0,0.3)]': props.deleteMessageDialog,
			'rounded-t-none': isAnnouncementMessage.value,
			'!bg-surface-low': contextMenuStore.isOpen && contextMenuStore.currentTargetId == props.event.event_id,
		};

		if (!isAnnouncementMessage.value || redactedMessage.value) {
			return baseClasses;
		}

		return {
			...baseClasses,
			'bg-surface-low': true,
		};
	});

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
		sidebar.openTab(SidebarTab.Thread);
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

		// Direct message (only if sender is not current user and not already in a DM)
		if (props.event.sender !== user.userId && !props.room.isDirectMessageRoom()) {
			menu.push({
				label: t('menu.direct_message'),
				icon: 'chat-circle',
				onClick: () => user.goToUserRoom(props.event.sender),
			});
		}

		// Reaction
		if (!redactedMessage.value) {
			menu.push({
				label: t('menu.add_reaction'),
				icon: 'smiley',
				onClick: () => {
					setTimeout(() => emit('reactionPanelToggle', props.event.event_id), 0);
				},
			});
		}

		// Reply
		if (!props.event.msgIsNotSend && !props.event.redactedMessage && !props.event.isThreadRoot) {
			menu.push({
				label: t('menu.reply'),
				icon: 'arrow-bend-up-left',
				onClick: () => reply(),
			});
		}

		// Thread reply (not in DM rooms)
		if (!props.viewFromThread && props.eventThreadLength <= 0 && canReplyInThread && !props.event.msgIsNotSend && !props.event.redactedMessage && !props.room.isDirectMessageRoom()) {
			menu.push({
				label: t('menu.reply_in_thread'),
				icon: 'chat-circle',
				onClick: () => replyInThread(),
			});
		}

		// Copy message text
		if (!redactedMessage.value && props.event.content.body) {
			menu.push({
				label: t('menu.copy_message'),
				icon: 'copy',
				onClick: () => navigator.clipboard.writeText(props.event.content.body),
			});
		}

		// Delete (only your own messages)
		if (settings.isFeatureEnabled(FeatureFlag.deleteMessages) && !props.event.msgIsNotSend && props.event.sender === user.userId && !props.event.redactedMessage && !(props.viewFromThread && props.event.isThreadRoot)) {
			menu.push({
				label: t('menu.delete_message'),
				icon: 'trash',
				isDelicate: true,
				onClick: () => onDeleteMessage(props.event),
			});
		}

		return menu;
	}
</script>
