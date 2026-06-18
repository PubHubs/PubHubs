<template>
	<div
		ref="messageRoot"
		v-context-menu="(evt: any) => openMenu(evt, getContextMenuItems(), event.event_id)"
	>
		<div
			ref="elReactionPopUp"
			class="group flex flex-col"
			:class="[
				!isAnnouncementMessage && 'hover:bg-surface-sunken/75',
				props.isGrouped ? 'pt-050!' : 'pt-200!',
				props.isFollowedByGrouped ? 'pb-050!' : 'pb-200!',
				getMessageContainerClasses,
				!isPrivilegedMessage && !redactedMessage && 'border-l-transparent',
				isPrivilegedMessage && !redactedMessage && 'border-y-on-surface-disabled border-y',
				(isAnnouncementMessage || isWhisperMessage) &&
					!redactedMessage &&
					(props.room.getPowerLevel(event.sender!) === 100
						? 'border-accent-steward border-l-4'
						: props.room.getPowerLevel(event.sender!) >= 50 && 'border-accent-steward border-l-4'),
			]"
			role="article"
		>
			<!-- Message Container -->
			<div
				class="relative flex w-full gap-200"
				:class="[
					getMessageContainerClasses,
					isMobile ? 'px-100' : 'px-250',
					props.isGrouped ? 'py-050!' : 'py-100!',
					!props.isFollowedByGrouped && 'pb-100!',
				]"
			>
				<!-- Reaction Panel -->
				<div
					v-if="showReactionPanel && hasBeenVisible"
					:class="['absolute right-0 bottom-full z-50', calculatePanelPlacement() ? 'bottom-full' : 'top-400']"
				>
					<ReactionMiniPopUp
						:event-id="event.event_id!"
						:room="room"
						@emoji-selected="emit('clickedEmoticon', $event, event.event_id!)"
						@close-panel="emit('reactionPanelClose')"
					/>
				</div>

				<!-- Avatar -->
				<Avatar
					v-if="!props.isGrouped && hasBeenVisible"
					:avatar-url="user.userAvatar(event.sender!)"
					:user-id="event.sender"
					:room-id="event.room_id ?? room.roomId"
					@mouseover="hover = true"
					@mouseleave="hover = false"
				/>

				<!-- Avatar placeholder -->
				<div
					v-else-if="!props.isGrouped"
					class="bg-surface-base flex aspect-square h-600 w-600 shrink-0 items-center justify-center overflow-hidden rounded-full"
				></div>

				<!-- Grouped spacer with hover time -->
				<div
					v-else
					class="flex w-600 shrink-0 items-center justify-center"
				>
					<EventTime
						:timestamp="event.origin_server_ts!"
						:show-date="false"
						class="text-on-surface-dim hidden text-[10px] group-hover:block"
					/>
				</div>

				<!-- Message and Actions -->
				<div
					:class="{ 'w-5/6': deleteMessageDialog, 'w-full': !deleteMessageDialog }"
					class="text-on-surface-bright min-w-0"
				>
					<div class="flex flex-wrap items-center overflow-hidden text-wrap break-all">
						<!-- Message Snippet -->
						<Suspense v-if="hasBeenVisible">
							<MessageSnippet
								v-if="inReplyToId && showReplySnippet(event.content!.msgtype!)"
								:event-id="inReplyToId"
								class="mb-100"
								:show-in-reply-to="true"
								:room="room"
								:hidden-message-label="replyHideState.label"
								@click="onInReplyToClick"
							/>
							<template #fallback>
								<div class="flex items-center gap-150 rounded-md px-100">
									<p>{{ t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>

						<div
							v-if="!props.isGrouped"
							class="gap-y-050 mb-100 flex w-full min-w-0 flex-wrap items-center gap-x-100"
						>
							<UserDisplayName
								:user-id="event.sender!"
								:user-display-name="user.userDisplayName(event.sender!)"
								:room-id="event.room_id ?? room.roomId"
							/>

							<RoomBadge
								v-if="hasBeenVisible && !room.isDirectMessageRoom()"
								class="inline-block"
								:user="event.sender!"
								:room-id="event.room_id ?? room.roomId"
								:room="room"
							/>

							<!-- Announcement -->
							<span
								v-if="isAnnouncementMessage && !redactedMessage"
								class="gap-050 inline-flex items-center leading-none"
								:class="
									props.room.getPowerLevel(event.sender!) === 100
										? 'text-accent-steward'
										: props.room.getPowerLevel(event.sender!) >= 50 && 'text-accent-steward'
								"
							>
								<span class="text-label-tiny uppercase">{{ t('rooms.announcement') }}</span>
							</span>

							<!-- Whisper -->
							<span
								v-if="isWhisperMessage && !redactedMessage && event.sender! !== user.userId"
								class="gap-050 inline-flex items-center leading-none"
								:class="
									props.room.getPowerLevel(event.sender!) === 100
										? 'text-accent-steward'
										: props.room.getPowerLevel(event.sender!) >= 50 && 'text-accent-steward'
								"
							>
								<span class="text-label-tiny uppercase">{{ t('message.only_visible_to_you') }}</span>
							</span>
							<span
								v-if="isWhisperMessage && !redactedMessage && event.sender === user.userId && event.content!.whisper_to"
								class="gap-050 inline-flex items-center leading-none"
								:class="
									props.room.getPowerLevel(event.sender!) === 100
										? 'text-accent-steward'
										: props.room.getPowerLevel(event.sender!) >= 50 && 'text-accent-steward'
								"
							>
								<span class="text-label-tiny puppercase">{{ t('message.whisper_to') }}: {{ whisperTargetDisplayName }}</span>
							</span>

							<!-- Timestamp -->
							<span class="text-label-tiny text-on-surface-dim gap-050 inline-flex items-center">
								<EventTime
									:timestamp="event.origin_server_ts!"
									:show-date="true"
								/>
								<EventTime
									:timestamp="event.origin_server_ts!"
									:show-date="false"
								/>
							</span>
						</div>

						<Suspense v-if="hasBeenVisible && inReplyToId && showWhisperReplySnippet">
							<MessageSnippet
								:event-id="inReplyToId"
								class="mb-100"
								:show-in-reply-to="true"
								:room="room"
								:hidden-message-label="replyHideState.label"
								@click="onInReplyToClick"
							/>
							<template #fallback>
								<div class="flex items-center gap-150 rounded-md px-100">
									<p>{{ t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>
					</div>

					<div
						v-if="showActions"
						class="relative"
					>
						<!-- Message Action Buttons -->
						<div
							class="rounded-base bg-background absolute right-0 flex shadow"
							:class="actionButtonPosition"
						>
							<template v-if="timerReady && !deleteMessageDialog">
								<button
									v-if="msgIsNotSend && connection.isOn"
									class="mb-050 ml-100"
									:title="t('errors.resend')"
									@click="resend()"
								>
									<Icon
										type="arrow-counter-clockwise"
										class="text-red"
									/>
								</button>
								<Icon
									v-if="msgIsNotSend && !connection.isOn"
									type="wifi-slash"
									class="text-red mb-050 ml-100"
								/>
							</template>

							<!-- Reaction Button -->
							<button
								v-if="!redactedMessage"
								class="text-accent-primary hover:bg-accent-primary hover:text-on-accent-primary p-050 hidden items-center justify-center rounded-md transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.reply_emoji')"
								@click.stop="emit('reactionPanelToggle', event.event_id!)"
							>
								<Icon type="smiley" />
							</button>

							<!-- Reply Button -->
							<button
								v-if="!msgIsNotSend && !redactedMessage"
								class="text-accent-primary hover:bg-accent-primary hover:text-on-accent-primary p-050 hidden items-center justify-center rounded-md transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.reply')"
								@click="reply"
							>
								<Icon type="arrow-bend-up-left" />
							</button>

							<!-- Thread Reply Button -->
							<button
								v-if="
									!deleteMessageDialog &&
									!viewFromThread &&
									canReplyInThread &&
									threadReplyCount <= 0 &&
									!msgIsNotSend &&
									!redactedMessage &&
									!props.room.isDirectMessageRoom()
								"
								class="text-accent-primary hover:bg-accent-primary hover:text-on-accent-primary p-050 hidden items-center justify-center rounded-md transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.reply_in_thread')"
								@click="replyInThread"
							>
								<Icon
									type="chat-circle"
									size="base"
								/>
							</button>

							<!-- Context Menu Button -->
							<button
								v-if="!redactedMessage"
								class="text-accent-primary hover:bg-accent-primary hover:text-on-accent-primary p-050 hidden items-center justify-center rounded-md transition-all duration-300 ease-in-out group-hover:flex hover:w-fit hover:cursor-pointer"
								:title="t('message.context_menu')"
								@click.stop="openMenu($event, getContextMenuItems(), event.event_id!)"
							>
								<Icon type="dots-three-vertical" />
							</button>
						</div>
					</div>

					<template v-if="hasBeenVisible">
						<MessageHidden
							v-if="(event.content?.ph_hidden === true || hideState.isHidden) && !redactedMessage"
							:overridelabel="hideState.label"
						>
							<!-- The actual message content goes here as a slot -->
							<PrivilegedMessageBody
								v-if="isPrivilegedMessage && !DirectRooms.includes(room.getType() as RoomType)"
								:event="privilegedEventContent"
							/>
							<MessageSigned
								v-else-if="event.content!.msgtype === PubHubsMgType.SignedMessage"
								:message="event.content!.signed_message"
								class="max-w-[90ch]"
							/>
							<MessageFile
								v-else-if="event.content!.msgtype === MsgType.File"
								:message="event.content as TFileMessageEventContent"
							/>
							<MessageImage
								v-else-if="event.content!.msgtype === MsgType.Image"
								:message="event.content as TImageMessageEventContent"
							/>
							<MessageDisclosureRequest
								v-else-if="event.content!.msgtype === PubHubsMgType.AskDisclosureMessage"
								:event="event as TMessageEvent"
								class="flex flex-col"
							/>
							<MessageDisclosed
								v-else-if="event.content!.msgtype === PubHubsMgType.DisclosedMessage"
								:message="event.content!.signed_message"
								class="max-w-[90ch]"
							/>
							<VotingWidget
								v-else-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && event.content!.msgtype === PubHubsMgType.VotingWidget"
								:room="room"
								:event="event as TVotingMessageEvent"
								@edit-poll="(poll, eventId) => emit('editPoll', poll, eventId)"
								@edit-scheduler="(scheduler, eventId) => emit('editScheduler', scheduler, eventId)"
							/>
							<MessageVideoCall
								v-else-if="event.content!.msgtype === PubHubsMgType.VideoCall"
								:event="props.event as any"
								:room-id="room.roomId"
							/>
							<Message
								v-else
								:event="event as TMessageEvent"
								:deleted="redactedMessage"
							/>
						</MessageHidden>

						<!-- Non-hidden messages render directly -->
						<template v-else-if="!redactedMessage">
							<PrivilegedMessageBody
								v-if="isPrivilegedMessage && !DirectRooms.includes(room.getType() as RoomType)"
								:event="privilegedEventContent"
							/>
							<MessageSigned
								v-else-if="event.content!.msgtype === PubHubsMgType.SignedMessage"
								:message="event.content!.signed_message"
								class="max-w-[90ch]"
							/>
							<MessageFile
								v-else-if="event.content!.msgtype === MsgType.File"
								:message="event.content as TFileMessageEventContent"
							/>
							<MessageImage
								v-else-if="event.content!.msgtype === MsgType.Image"
								:message="event.content as TImageMessageEventContent"
							/>
							<MessageDisclosureRequest
								v-else-if="event.content!.msgtype === PubHubsMgType.AskDisclosureMessage"
								:event="event as TMessageEvent"
								class="flex flex-col"
							/>
							<MessageDisclosed
								v-else-if="event.content!.msgtype === PubHubsMgType.DisclosedMessage"
								:message="event.content!.signed_message"
								class="max-w-[90ch]"
							/>
							<VotingWidget
								v-else-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && event.content!.msgtype === PubHubsMgType.VotingWidget"
								:room="room"
								:event="event as TVotingMessageEvent"
								@edit-poll="(poll, eventId) => emit('editPoll', poll, eventId)"
								@edit-scheduler="(scheduler, eventId) => emit('editScheduler', scheduler, eventId)"
							/>
							<MessageVideoCall
								v-else-if="event.content!.msgtype === PubHubsMgType.VideoCall"
								:event="props.event as any"
								:room-id="room.roomId"
							/>
							<Message
								v-else
								:event="event as TMessageEvent"
								:deleted="redactedMessage"
							/>
						</template>
						<Message
							v-else
							:event="event as TMessageEvent"
							:deleted="redactedMessage"
						/>
					</template>

					<!-- View-thread affordance: visible when this message has thread replies and we're not already inside the thread view. -->
					<button
						v-if="threadReplyCount > 0 && !viewFromThread && !redactedMessage && !room.isDirectMessageRoom() && !room.isForumRoom()"
						type="button"
						class="text-accent-primary hover:text-accent-primary/80 text-label-small gap-050 mt-100 inline-flex items-center hover:cursor-pointer hover:underline"
						@click="replyInThread"
					>
						<Icon
							type="chat-circle"
							size="sm"
							aria-hidden="true"
						/>
						<span>{{ t('message.view_thread', threadReplyCount, { named: { count: threadReplyCount } }) }}</span>
					</button>

					<div
						v-if="$slots.bottom || $slots.extras"
						class="flex items-end justify-between gap-200"
					>
						<!-- Extra slot bottom: forum stuff -->
						<slot name="bottom"></slot>
						<!-- Extra slot right: forum stuff -->
						<slot name="extras"></slot>
					</div>
				</div>
			</div>

			<!-- Reactions Slot -->
			<div v-if="hasBeenVisible">
				<slot name="reactions"></slot>
			</div>
			<HideMessageDialog
				v-if="hideMessageDialog.visible"
				@close="hideMessageDialog.visible = false"
				@submit="onHideMessageDialogSubmit"
			></HideMessageDialog>
			<ReportDialog
				v-if="reportDialog.visible"
				@close="reportDialog.visible = false"
				@submit="onReportDialogSubmit"
			></ReportDialog>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { MatrixEvent, MsgType } from 'matrix-js-sdk';
	import { capitalize, computed, onBeforeUnmount, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import HideMessageDialog from '@hub-client/components/forms/HideMessageDialog.vue';
	import ReportDialog from '@hub-client/components/forms/ReportDialog.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import Message from '@hub-client/components/rooms/Message.vue';
	import MessageDisclosed from '@hub-client/components/rooms/MessageDisclosed.vue';
	import MessageDisclosureRequest from '@hub-client/components/rooms/MessageDisclosureRequest.vue';
	import MessageFile from '@hub-client/components/rooms/MessageFile.vue';
	import MessageHidden from '@hub-client/components/rooms/MessageHidden.vue';
	import MessageImage from '@hub-client/components/rooms/MessageImage.vue';
	import MessageSigned from '@hub-client/components/rooms/MessageSigned.vue';
	import MessageSnippet from '@hub-client/components/rooms/MessageSnippet.vue';
	import MessageVideoCall from '@hub-client/components/rooms/MessageVideoCall.vue';
	import PrivilegedMessageBody from '@hub-client/components/rooms/PrivilegedMessageBody.vue';
	import RoomBadge from '@hub-client/components/rooms/RoomBadge.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import VotingWidget from '@hub-client/components/rooms/voting/VotingWidget.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';
	import ReactionMiniPopUp from '@hub-client/components/ui/ReactionMiniPopUp.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useModerationCreateReport } from '@hub-client/composables/moderation/create-report.composable';
	import { useModerationHideMessage } from '@hub-client/composables/moderation/hide-message.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
	import { CONFIG } from '@hub-client/logic/logging/Config';

	// Models
	import { ContextVariant, type MenuItem } from '@hub-client/models/components/contextMenu.models';
	import { RelationType } from '@hub-client/models/constants';
	import { type TBaseEvent } from '@hub-client/models/events/TBaseEvent';
	import { type TMessageEvent, type TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TAnnouncementMessageEventContent, type TWhisperMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
	import { type TVotingMessageEvent } from '@hub-client/models/events/voting/TVotingMessageEvent';
	import { type Poll, type Scheduler } from '@hub-client/models/events/voting/VotingTypes';
	import type Room from '@hub-client/models/rooms/Room';
	import { DirectRooms, type RoomType } from '@hub-client/models/rooms/TBaseRoom';
	import { UserPowerLevel } from '@hub-client/models/users/TUser';

	// Stores
	import { useConnection } from '@hub-client/stores/connection';
	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { useMessageActions } from '@hub-client/stores/message-actions';
	import { Message as MessageBoxMessage, MessageType, useMessageBox } from '@hub-client/stores/messagebox';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(
		defineProps<{
			activeProfileCard?: string | null;
			activeReactionPanel?: string | null;
			addWhisperSpacing?: boolean;
			deleteMessageDialog?: boolean;
			event: TimelineEvent | MatrixEvent | TMessageEvent<TMessageEventContent>; // different types can be passed, they are cast to usable types in the computed event
			isFollowedByGrouped?: boolean;
			isGrouped?: boolean;
			room: Room;
			showActions?: boolean;
			viewFromThread?: boolean;
		}>(),
		{
			activeProfileCard: null,
			activeReactionPanel: null,
			addWhisperSpacing: false,
			deleteMessageDialog: false,
			isFollowedByGrouped: false,
			isGrouped: false,
			showActions: true,
			viewFromThread: false,
		},
	);

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
		(e: 'deleteMessage', event: TMessageEvent): void;
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
		(e: 'reactionPanelToggle', eventId: string): void;
		(e: 'reactionPanelClose'): void;
		(e: 'profileCardClose'): void;
		(e: 'clickedEmoticon', emoji: string, eventId: string): void;
	}>();

	const contextMenuStore = useContextMenuStore();
	const { openMenu } = useContextMenu();
	const connection = useConnection();
	const messageActions = useMessageActions();
	const pubhubs = usePubhubsStore();
	const sidebar = useSidebar();
	const user = useUser();
	const roles = useRoles();
	const settings = useSettings();
	const hubSettings = useHubSettings();
	const rooms = useRooms();
	const { t } = useI18n();
	const hover = ref(false);
	const elReactionPopUp = ref<HTMLElement | null>(null);
	const source = ref('');

	const isMobile = computed(() => settings.isMobileState);

	// Intersection observer
	const messageRoot = ref<HTMLElement | null>(null);
	const isVisible = ref(false);
	const hasBeenVisible = ref(false);
	let observer: IntersectionObserver | null = null;

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
		if (props.activeProfileCard === event.value.event_id!) {
			emit('profileCardClose');
		}
	});
	const { unHideMessage, hideMessageDialog, onHideMessageDialogSubmit, openHideMessageDialog } = useModerationHideMessage();
	const { reportDialog, openReportDialog, onReportDialogSubmit } = useModerationCreateReport();

	/**
	 * Different types can be passed in props.event, this selects the event property from each type
	 */
	const event = computed(() => {
		if (props.event instanceof TimelineEvent) return props.event.matrixEvent.event;
		if (props.event instanceof MatrixEvent) return props.event.event;
		return props.event as TMessageEvent<TMessageEventContent>;
	});

	const deletedEvent = computed(() => {
		if (props.event instanceof TimelineEvent) return props.event.isDeleted;
		return false;
	});

	const threadReplyCount = computed(() => {
		const eventId = event.value.event_id;
		if (!eventId) return 0;
		return rooms.threadLengths[props.room.roomId]?.[eventId] ?? 0;
	});

	const inReplyToId = event.value.content?.[RelationType.RelatesTo]?.[RelationType.InReplyTo]?.event_id ?? '';

	const showReactionPanel = computed(() => props.activeReactionPanel === event.value.event_id);

	const msgIsNotSend = computed(() => event.value.event_id!.substring(0, 1) === '~');

	const canReplyInThread = computed(() => !event.value.content![RelationType.RelatesTo]);

	// True when this component is rendering the thread root inside the thread sidebar (vs a reply).
	// Used by the context menu to suppress actions that would target the message you're already threading from.
	const viewingOwnThread = computed(() => props.viewFromThread && props.room.currentThreadId === event.value.event_id);

	const containsRedactedBecause = event.value.unsigned?.redacted_because !== undefined;

	const hideState = computed(() => props.room.getHideState(event.value.event_id!));
	const replyHideState = computed(() => props.room.getHideState(inReplyToId));

	const redactedMessage = computed(() => {
		return deletedEvent.value || containsRedactedBecause;
	});

	const isAnnouncementMessage = computed(() => event.value.content!.msgtype === PubHubsMgType.AnnouncementMessage);
	const isWhisperMessage = computed(() => event.value.content!.msgtype === PubHubsMgType.WhisperMessage);
	const isPrivilegedMessage = computed(() => isAnnouncementMessage.value || isWhisperMessage.value);
	const whisperTargetDisplayName = computed(() => {
		const whisperToUserId = event.value.content!.whisper_to;
		if (!whisperToUserId) return '';
		return user.userDisplayName(whisperToUserId) ?? whisperToUserId;
	});

	const isFirstInGroup = computed(() => props.isFollowedByGrouped && !props.isGrouped);
	const isLastInGroup = computed(() => props.isGrouped && !props.isFollowedByGrouped);

	const actionButtonPosition = computed(() => {
		if (isFirstInGroup.value) return 'bottom-0 mb-1';
		if (isLastInGroup.value) return 'top-0 mt-1';
		return 'top-0';
	});

	const getMessageContainerClasses = computed(() => {
		const baseClasses = {
			'p-100 transition-all duration-150 ease-in-out': !props.deleteMessageDialog,
			'rounded-t-none': isAnnouncementMessage.value,
			'bg-surface-sunken!': contextMenuStore.isOpen && contextMenuStore.currentTargetId === event.value.event_id,
		};

		if (!isPrivilegedMessage.value || redactedMessage.value) {
			return baseClasses;
		}

		return {
			...baseClasses,
			'bg-surface-base': true,
		};
	});

	// Placed inside the template eslint takes the | as a deprecate vue filter and throws an error
	const privilegedEventContent = computed(() => event.value.content as TAnnouncementMessageEventContent | TWhisperMessageEventContent);

	/**
	 * Returns boolean whether the reply snippet can be shown
	 * When in a thread: images and files always get an reply, so it is not clear if they are meant to be a reply.
	 * Like Element we remove the replysnippet in that case.
	 */
	function showReplySnippet(msgType: string): boolean {
		if (isWhisperMessage.value) return false;
		if (props.viewFromThread) {
			if (msgType === MsgType.Image || msgType === MsgType.File) {
				return false;
			}
		}
		return !!inReplyToId && !redactedMessage.value;
	}

	const showWhisperReplySnippet = computed(() => isWhisperMessage.value && !!inReplyToId && !redactedMessage.value);

	function onInReplyToClick() {
		if (!inReplyToId) return;
		emit('inReplyToClick', inReplyToId);
	}

	function onDeleteMessage(event: TMessageEvent) {
		emit('deleteMessage', event);
	}

	function reply() {
		messageActions.whisperingToUserId = undefined;
		messageActions.whisperingToDisplayName = undefined;
		messageActions.whisperingToEventId = undefined;
		messageActions.replyingTo = event.value.event_id;
	}

	function replyInThread() {
		const isSameThread = props.room.currentThreadId === event.value.event_id;
		if (isSameThread && sidebar.activeTab.value === SidebarTab.Thread) {
			props.room.setCurrentThreadId(undefined);
			sidebar.close();
		} else {
			props.room.setCurrentThreadId(event.value.event_id);
			sidebar.openTab(SidebarTab.Thread);
		}
	}

	function resend() {
		pubhubs.resendEvent(event.value as TBaseEvent);
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

	const canWhisperFromContextMenu = computed(() => {
		if (!user.userId) return false;
		const currentUserPowerLevel = props.room.getPowerLevel(user.userId);
		return currentUserPowerLevel >= UserPowerLevel.Steward;
	});

	function getContextMenuItems() {
		const social: MenuItem[] = [];
		const actions: MenuItem[] = [];
		const utility: MenuItem[] = [];
		const stewardActions: MenuItem[] = [];
		const destructive: MenuItem[] = [];

		// Direct message (only if sender is not current user and not already in a DM)
		if (event.value.sender! !== user.userId && !props.room.isDirectMessageRoom()) {
			social.push({
				label: t('menu.direct_message'),
				icon: 'chat-circle',
				onClick: () => user.goToUserRoom(event.value.sender!),
			});
		}

		// Whisper (steward/super-steward only, for other users)
		if (
			settings.isFeatureEnabled(FeatureFlag.whisper) &&
			event.value.sender! !== user.userId &&
			!props.room.isDirectMessageRoom() &&
			canWhisperFromContextMenu.value
		) {
			stewardActions.push({
				label: t('menu.whisper'),
				icon: 'whisper',
				onClick: () => {
					messageActions.replyingTo = undefined;
					messageActions.whisperingToUserId = event.value.sender;
					messageActions.whisperingToDisplayName = user.userDisplayName(event.value.sender!);
					messageActions.whisperingToEventId = event.value.event_id;
				},
				variant: ContextVariant.steward,
			});
		}

		// Reaction
		if (!redactedMessage.value) {
			actions.push({
				label: t('menu.add_reaction'),
				icon: 'smiley',
				onClick: () => {
					setTimeout(() => emit('reactionPanelToggle', event.value.event_id!), 0);
				},
			});
		}

		// Reply
		if (!msgIsNotSend.value && !redactedMessage.value) {
			actions.push({
				label: t('menu.reply'),
				icon: 'arrow-bend-up-left',
				onClick: () => reply(),
			});
		}

		// Thread reply (not in DM rooms)
		if (
			!props.viewFromThread &&
			threadReplyCount.value <= 0 &&
			canReplyInThread.value &&
			!msgIsNotSend.value &&
			!redactedMessage.value &&
			!props.room.isDirectMessageRoom()
		) {
			actions.push({
				label: t('menu.reply_in_thread'),
				icon: 'chat-circle',
				onClick: () => replyInThread(),
			});
		}

		// Copy message text
		if (!redactedMessage.value && typeof event.value.content!.body === 'string') {
			utility.push({
				label: t('menu.copy_message'),
				icon: 'copy',
				onClick: () => {
					const text = event.value.content!.body;
					const mb = useMessageBox();
					if (mb.inIframe) {
						mb.sendMessage(new MessageBoxMessage(MessageType.ClipboardWrite, text));
					} else {
						navigator.clipboard.writeText(text);
					}
				},
			});
		}

		// Report message (only for other users' messages)
		if (!redactedMessage.value && event.value.sender !== user.userId && !props.room.isDirectMessageRoom()) {
			utility.push({
				label: capitalize(t('moderation.report_message')),
				icon: 'warning',
				onClick: () => openReportDialog(props.room.roomId, event.value.event_id!),
			});
		}

		// Hide a message (own message: regular action; someone else's: steward action)
		const canHideOrShow =
			!msgIsNotSend.value &&
			!redactedMessage.value &&
			!viewingOwnThread.value &&
			(event.value.sender! === user.userId || roles.userIsStewardOrHigher(props.room.roomId));
		if (canHideOrShow && !hideState.value.isHidden) {
			const target = event.value.sender! === user.userId ? utility : stewardActions;
			target.push({
				label: capitalize(t('menu.hide_message')),
				icon: 'eye-slash',
				...(event.value.sender! === user.userId ? {} : { variant: ContextVariant.steward }),
				onClick: () => openHideMessageDialog(props.room.roomId, event.value.event_id!),
			});
		}

		// UnHide a message
		if (canHideOrShow && hideState.value.isHidden) {
			const target = event.value.sender! === user.userId ? utility : stewardActions;
			target.push({
				label: capitalize(t('menu.show_message')),
				icon: 'eye',
				...(event.value.sender! === user.userId ? {} : { variant: ContextVariant.steward }),
				onClick: () => unHideMessage(props.room.roomId, event.value.event_id!),
			});
		}

		// Delete (only your own messages or if you are steward or higher)
		if (
			settings.isFeatureEnabled(FeatureFlag.deleteMessages) &&
			!msgIsNotSend.value &&
			(event.value.sender! === user.userId || roles.userIsStewardOrHigher(props.room.roomId)) &&
			!redactedMessage.value &&
			!viewingOwnThread.value
		) {
			destructive.push({
				label: t('menu.delete_message'),
				icon: 'trash',
				variant: ContextVariant.delicate,
				onClick: () => onDeleteMessage(event.value as TMessageEvent),
			});
		}

		const divider: MenuItem = { divider: true, label: '' };
		return [social, actions, utility, stewardActions, destructive].filter((g) => g.length > 0).flatMap((g, i) => (i === 0 ? g : [divider, ...g]));
	}
</script>
