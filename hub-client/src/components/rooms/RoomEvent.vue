<template>
	<div>
		<!-- Plugin Event -->
		<div v-if="event.plugin && event.plugin.plugintype === PluginType.EVENT && event.type === event.plugin.type">
			<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
		</div>
		<!-- Normal Event -->
		<div
			v-else
			class="group flex gap-4 pl-6 pr-3 py-4"
			:class="{ 'transition-all duration-150 ease-in-out hover:bg-lightgray-light hover:dark:bg-hub-background-2': !deleteMessageDialog, 'mx-4 shadow-[0_0_5px_0_rgba(0,0,0,0.3)] rounded': props.deleteMessageDialog }"
		>
			<Avatar :userId="event.sender" :room="room"></Avatar>
			<div :class="{ 'w-5/6': deleteMessageDialog, 'w-4/5 xl:w-3/5': !deleteMessageDialog }">
				<div class="flex flex-wrap items-center">
					<div class="relative flex flex-wrap items-center w-full gap-x-2 md:w-fit pr-2 min-h-6">
						<UserDisplayName :user="event.sender" :room="room"></UserDisplayName>
						<div class="flex gap-2 flex-wrap">
							<span class="text-xs font-normal">|</span>
							<EventTime :timestamp="event.origin_server_ts" :showDate="false"> </EventTime>
							<span class="text-xs font-normal">|</span>
							<EventTime :timestamp="event.origin_server_ts" :showDate="true"> </EventTime>
						</div>
						<template v-if="timerReady && !deleteMessageDialog">
							<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="ml-2 mb-1" :title="$t('errors.resend')">
								<Icon type="refresh" size="sm" class="text-red"></Icon>
							</button>
							<Icon v-if="msgIsNotSend && !connection.isOn" type="lost-connection" size="sm" class="ml-2 mb-1 text-red"></Icon>
						</template>
						<RoomEventActionsPopup v-if="!deleteMessageDialog">
							<button v-if="!msgIsNotSend && !redactedMessage" @click="reply" class="p-1 bg-gray-lighter hover:bg-gray-light dark:bg-gray-middle hover:dark:bg-gray-darker rounded-md">
								<Icon :type="'reply'" :size="'xs'"></Icon>
							</button>
							<button
								v-if="!msgIsNotSend && user.isAdmin && event.sender !== user.user.userId"
								@click="router.push({ name: 'ask-disclosure', query: { user: event.sender } })"
								class="flex p-1 bg-gray-lighter hover:bg-gray-light dark:bg-gray-middle hover:dark:bg-gray-darker rounded-md"
								:title="$t('menu.moderation_tools_disclosure')"
							>
								<Icon :type="'warning'" :size="'xs'"></Icon>
							</button>
							<button
								v-if="settings.isFeatureEnabled(featureFlagType.deleteMessages) && !msgIsNotSend && event.sender === user.user.userId && !redactedMessage"
								@click="onDeleteMessage(event)"
								class="p-1 bg-gray-lighter dark:bg-gray-middle hover:bg-red hover:text-white dark:hover:bg-red dark:hover:text-white rounded-md"
								:title="$t('menu.delete_message')"
							>
								<Icon :type="'bin'" :size="'xs'"></Icon>
							</button>
						</RoomEventActionsPopup>
						<ProfileAttributes v-if="props.room.getType() == RoomType.PH_MESSAGES_RESTRICTED" :user="event.sender" :room_id="event.room_id"></ProfileAttributes>
					</div>
				</div>
				<template v-if="event.plugin?.plugintype === PluginType.MESSAGE && event.content.msgtype === event.plugin.type">
					<!-- Plugin Message -->
					<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
				</template>
				<template v-else>
					<Suspense>
						<!-- Temporary fix to set the background color of the MessageSnippet in the dialog to delete a message -->
						<MessageSnippet :class="{ '!bg-[#e2e2e2]': deleteMessageDialog }" v-if="inReplyToId && !redactedMessage" @click="onInReplyToClick" :eventId="inReplyToId" :showInReplyTo="true" :room="room"></MessageSnippet>
						<template #fallback>
							<div class="bg-hub-background-3 flex px-2 gap-3 items-center rounded-md">
								<p>{{ $t('state.loading_message') }}</p>
							</div>
						</template>
					</Suspense>
					<Message v-if="event.content.msgtype === 'm.text' || redactedMessage" :event="event" :deleted="redactedMessage"></Message>
					<!-- Temporary fix to set the background color of the signed message in the dialog to delete a message -->
					<MessageSigned :class="{ '!bg-[#e2e2e2]': deleteMessageDialog }" v-if="event.content.msgtype === 'pubhubs.signed_message' && !redactedMessage" :message="event.content.signed_message"></MessageSigned>
					<MessageFile v-if="event.content.msgtype === 'm.file' && !redactedMessage" :message="event.content"></MessageFile>
					<MessageImage v-if="event.content.msgtype === 'm.image' && !redactedMessage" :message="event.content"></MessageImage>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { router } from '@/core/router';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { featureFlagType, RoomType, useConnection, useSettings, useUser } from '@/store/store';
	import { useMessageActions } from '@/store/message-actions';
	import { PluginType } from '@/store/plugins';
	import { TMessageEvent } from '@/model/model';
	import Room from '@/model/rooms/Room';

	const connection = useConnection();
	const messageActions = useMessageActions();

	const user = useUser();

	const settings = useSettings();

	const props = withDefaults(defineProps<{ event: TMessageEvent; room: Room; deleteMessageDialog?: boolean }>(), { deleteMessageDialog: false });

	const inReplyToId = props.event.content['m.relates_to']?.['m.in_reply_to']?.event_id;

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
		(e: 'deleteMessage', event: TMessageEvent): void;
	}>();

	const msgIsNotSend = computed(() => {
		return props.event.event_id.substring(0, 1) === '~';
	});

	const redactedMessage = computed(() => {
		const inRedactedMessageIds = props.room.inRedactedMessageIds(props.event.event_id);
		const containsRedactedBecause = props.event.unsigned?.redacted_because != undefined;
		// Remove the event id from the list with redacted event IDs if the event already contains the redacted_because key
		if (inRedactedMessageIds && containsRedactedBecause) {
			props.room.removeRedactedEventId(props.event.event_id);
		}
		return inRedactedMessageIds || containsRedactedBecause;
	});

	function onInReplyToClick() {
		if (!inReplyToId) return;
		emit('inReplyToClick', inReplyToId);
	}

	function onDeleteMessage(event: TMessageEvent) {
		emit('deleteMessage', event);
	}

	function reply() {
		messageActions.replyingTo = undefined;
		messageActions.replyingTo = props.event.event_id;
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
