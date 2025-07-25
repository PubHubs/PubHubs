<template>
	<div>
		<!-- Plugin Event -->
		<div v-if="event.plugin && event.plugin.plugintype === PluginType.EVENT && event.type === event.plugin.type">
			<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
		</div>

		<!-- Normal Event -->
		<!--Styling changed to keep the top border for announcement-->
		<div v-else class="group flex flex-col py-3">
			<div
				v-if="isAnnouncementMessage && !redactedMessage"
				class="flex w-full items-center bg-surface-high px-8 py-1 ~text-label-small-min/label-small-max"
				:class="{
					'mx-4': props.deleteMessageDialog,
				}"
			>
				<Icon type="announcement" size="sm" class="mr-1"></Icon>
				{{ getAnnouncementTitle }}
			</div>

			<div class="flex w-full gap-4 px-6" :class="getMessageContainerClasses">
				<Avatar :userId="event.sender" />
				<div :class="{ 'w-5/6': deleteMessageDialog, 'w-full': !deleteMessageDialog }" class="min-w-0">
					<div class="flex flex-wrap items-center overflow-hidden text-wrap break-all">
						<div class="relative flex min-h-6 w-full items-start gap-x-2 pb-1">
							<div class="flex w-full min-w-0 flex-grow flex-wrap items-center gap-2">
								<UserDisplayName :user="event.sender" :room="room" />
								<span class="flex gap-2">
									<span class="~text-label-small-min/label-small-max">|</span>
									<EventTime :timestamp="event.origin_server_ts" :showDate="false"> </EventTime>
									<span class="~text-label-small-min/label-small-max">|</span>
									<EventTime :timestamp="event.origin_server_ts" :showDate="true"> </EventTime>
								</span>

								<RoomBadge v-if="!room.isPrivateRoom() && !room.isGroupRoom() && !room.isAdminContactRoom()" class="inline-block" :user="event.sender" :room_id="event.room_id"></RoomBadge>
							</div>
							<div>
								<template v-if="timerReady && !deleteMessageDialog">
									<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="mb-1 ml-2" :title="$t('errors.resend')">
										<Icon type="refresh" size="sm" class="text-red" />
									</button>
									<Icon v-if="msgIsNotSend && !connection.isOn" type="lost-connection" size="sm" class="text-red mb-1 ml-2" />
								</template>

								<RoomEventActionsPopup v-if="!deleteMessageDialog">
									<button
										v-if="!msgIsNotSend && !redactedMessage && !isThreadRoot"
										@click="reply"
										class="flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-all duration-300 ease-in-out hover:w-fit hover:bg-accent-primary hover:text-on-accent-primary"
										:title="$t('message.reply')"
									>
										<Icon :type="'reply'" size="xs" />
									</button>
									<button
										v-if="!viewFromThread && threadLength <= 0 && canReplyInThread && !msgIsNotSend && !redactedMessage"
										@click="replyInThread"
										class="flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-all duration-300 ease-in-out hover:w-fit hover:bg-accent-primary hover:text-on-accent-primary"
										:title="$t('message.reply_in_thread')"
									>
										<Icon :type="'talk'" :size="'xs'"></Icon>
									</button>
									<button
										v-if="!msgIsNotSend && user.isAdmin && event.sender !== user.user.userId && settings.isFeatureEnabled(FeatureFlag.disclosure)"
										@click="router.push({ name: 'ask-disclosure', query: { user: event.sender } })"
										class="flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-all duration-300 ease-in-out hover:w-fit hover:bg-accent-primary hover:text-on-accent-primary"
										:title="$t('menu.moderation_tools_disclosure')"
									>
										<Icon :type="'warning'" size="xs" />
									</button>
									<button
										v-if="settings.isFeatureEnabled(FeatureFlag.deleteMessages) && !msgIsNotSend && event.sender === user.user.userId && !redactedMessage && !(props.viewFromThread && isThreadRoot)"
										@click="onDeleteMessage(event)"
										class="flex items-center justify-center rounded-md p-1 text-on-surface-variant transition-all duration-300 ease-in-out hover:w-fit hover:bg-accent-red hover:text-on-accent-red"
										:title="$t('menu.delete_message')"
									>
										<Icon :type="'bin'" size="xs" />
									</button>
								</RoomEventActionsPopup>
							</div>
						</div>
					</div>
					<template v-if="event.plugin?.plugintype === PluginType.MESSAGE && event.content.msgtype === event.plugin.type">
						<!-- Plugin Message -->
						<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
					</template>

					<template v-else>
						<Suspense>
							<MessageSnippet v-if="showReplySnippet(event.content.msgtype)" @click="onInReplyToClick" :eventId="inReplyToId" :showInReplyTo="true" :room="room"></MessageSnippet>
							<template #fallback>
								<div class="flex items-center gap-3 rounded-md px-2">
									<p>{{ $t('state.loading_message') }}</p>
								</div>
							</template>
						</Suspense>

						<Message v-if="event.content.msgtype === MsgType.Text || redactedMessage" :event="event" :deleted="redactedMessage" class="max-w-[90ch]" />
						<AnnouncementMessage v-if="isAnnouncementMessage && !redactedMessage && !room.isPrivateRoom()" :event="event.content"></AnnouncementMessage>
						<MessageSigned v-if="event.content.msgtype === PubHubsMgType.SignedMessage && !redactedMessage" :message="event.content.signed_message" class="max-w-[90ch]" />
						<MessageFile v-if="event.content.msgtype === MsgType.File && !redactedMessage" :message="event.content" />
						<MessageImage v-if="event.content.msgtype === MsgType.Image && !redactedMessage" :message="event.content" />

						<VotingWidget
							v-if="settings.isFeatureEnabled(FeatureFlag.votingWidget) && event.content.msgtype === PubHubsMgType.VotingWidget && !redactedMessage"
							:event="event"
							@edit-poll="(poll, eventId) => emit('editPoll', poll, eventId)"
							@edit-scheduler="(scheduler, eventId) => emit('editScheduler', scheduler, eventId)"
						></VotingWidget>
					</template>

					<button
						@click="replyInThread"
						class="bg-hub-background-3 inline-flex rounded-md px-2 py-1 ~text-label-tiny-min/label-tiny-max hover:opacity-80"
						v-if="!deleteMessageDialog && !viewFromThread && threadLength > 0 && canReplyInThread && !msgIsNotSend && !redactedMessage"
					>
						<Icon :type="'talk'" :size="'xs'"></Icon>
						&nbsp; {{ $t('message.threads.view_thread') }} ({{ threadLength }})
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { router } from '@/logic/core/router';
	import { TMessageEvent } from '@/model/events/TMessageEvent';
	import { RelationType } from '@/model/constants';
	import Room from '@/model/rooms/Room';
	import { useConnection } from '@/logic/store/connection';
	import { useMessageActions } from '@/logic/store/message-actions';
	import { PluginType } from '@/logic/store/plugins';

	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { useUser } from '@/logic/store/user';
	import { PubHubsMgType } from '@/logic/core/events';

	// Components
	import AnnouncementMessage from './AnnouncementMessage.vue';
	import MessageSnippet from './MessageSnippet.vue';
	import Message from './Message.vue';
	import MessageFile from './MessageFile.vue';
	import MessageImage from './MessageImage.vue';
	import MessageSigned from './MessageSigned.vue';
	import RoomEventActionsPopup from './RoomEventActionsPopup.vue';
	import Avatar from '../ui/Avatar.vue';
	import EventTime from './EventTime.vue';
	import RoomBadge from './RoomBadge.vue';
	import UserDisplayName from './UserDisplayName.vue';
	import Icon from '../elements/Icon.vue';

	// Dependencies
	import { MsgType } from 'matrix-js-sdk';
	import { computed, ref, watch, onMounted } from 'vue';
	import { useI18n } from 'vue-i18n';
	import VotingWidget from '@/components/rooms/voting/VotingWidget.vue';
	import { Poll, Scheduler } from '@/model/events/voting/VotingTypes';

	// Stores
	const connection = useConnection();
	const messageActions = useMessageActions();
	const user = useUser();
	const settings = useSettings();
	const { t } = useI18n();

	let threadLength = ref(0);

	const props = defineProps({
		event: {
			type: Object as () => TMessageEvent,
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
		deleteMessageDialog: {
			type: Boolean,
			default: false,
		},
	});

	onMounted(() => (threadLength.value = props.eventThreadLength));

	/**
	 * Watch the threadlength for external changes, done by other users
	 */
	watch(
		() => props.eventThreadLength,
		() => {
			threadLength.value = props.eventThreadLength;
		},
	);

	const roomMember = props.room.getMember(props.event.sender, true);
	if (!roomMember) throw new Error('Sender of event not found while trying to display event.');

	const inReplyToId = props.event.content[RelationType.RelatesTo]?.[RelationType.InReplyTo]?.event_id;

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
		(e: 'deleteMessage', event: TMessageEvent): void;
		(e: 'editPoll', poll: Poll, eventId: string): void;
		(e: 'editScheduler', scheduler: Scheduler, eventId: string): void;
	}>();

	const msgIsNotSend = computed(() => props.event.event_id.substring(0, 1) === '~');

	const canReplyInThread = computed(() => !props.event.content['m.relates_to']);

	const isThreadRoot = computed(() => props.room.currentThread?.threadId === props.event.event_id);

	const containsRedactedBecause = props.event.unsigned?.redacted_because !== undefined;

	const redactedMessage = computed(() => {
		const inRedactedMessageIds = props.room.inRedactedMessageIds(props.event.event_id);
		// Remove the event id from the list with redacted event IDs if the event already contains the redacted_because key
		if (inRedactedMessageIds && containsRedactedBecause) {
			props.room.removeRedactedEventId(props.event.event_id);
		}
		return inRedactedMessageIds || containsRedactedBecause;
	});

	const isAnnouncementMessage = computed(() => props.event.content.msgtype === PubHubsMgType.AnnouncementMessage);

	const getAnnouncementTitle = computed(() => getUserTitleForAnnouncement(props.event.sender));

	// Styling of the event based on announcment message
	const getMessageContainerClasses = computed(() => {
		// Base classes
		const baseClasses = {
			'p-2 transition-all duration-150 ease-in-out hover:bg-surface-low': !props.deleteMessageDialog,
			'mx-4 rounded shadow-[0_0_5px_0_rgba(0,0,0,0.3)]': props.deleteMessageDialog,
			'rounded-t-none': isAnnouncementMessage.value,
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
		const pubhubs = usePubHubs();
		pubhubs.resendEvent(props.event);
	}

	// Waits for checking if message is realy send. Otherwise a 'resend' button appears. See also msgIsNotSend computed.
	const timerReady = ref(false);
	window.setTimeout(() => {
		timerReady.value = true;
	}, 1000);
</script>
