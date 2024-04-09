<template>
	<div>
		<!-- Plugin Event -->
		<div v-if="event.plugin && event.plugin.plugintype == PluginType.EVENT && event.type == event.plugin.type">
			<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
		</div>
		<!-- Normal Event -->

		<div v-if="hubSettings.isVisibleEventType(event.type) && hubSettings.skipNoticeUserEvent(event)" class="group flex flex-row space-x-4 mb-8">
			<Avatar :userId="event.sender"></Avatar>
			<div class="w-4/5 md:w-3/5">
				<div class="flex items-center">
					<div class="flex flex-wrap">
						<div class="flex items-center gap-x-2 mb-0 mr-2 h-6 whitespace-nowrap">
							<UserDisplayName :user="event.sender"></UserDisplayName>
							<span class="text-xs font-normal">|</span>
							<EventTime :timestamp="event.origin_server_ts" :showDate="false"> </EventTime>
							<span class="text-xs font-normal">|</span>
							<EventTime :timestamp="event.origin_server_ts" :showDate="true"> </EventTime>
						</div>
						<template v-if="timerReady">
							<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="ml-2 mb-1" :title="$t('errors.resend')">
								<Icon type="refresh" size="sm" class="text-red"></Icon>
							</button>
							<Icon v-if="msgIsNotSend && !connection.isOn" type="lost-connection" size="sm" class="ml-2 mb-1 text-red"></Icon>
						</template>
						<RoomEventActionsPopup class="hidden group-hover:block">
							<router-link v-if="!msgIsNotSend && user.isAdmin && event.sender != user.user.userId" :to="{ name: 'ask-disclosure', query: { user: event.sender } }">
								<button :title="$t('menu.moderation_tools_disclosure')">
									<Icon :type="'warning'" :size="'sm'"></Icon>
								</button>
							</router-link>
							<button v-if="!msgIsNotSend" @click="reply" class="mb-1">
								<Icon :type="'reply'" :size="'sm'"></Icon>
							</button>
						</RoomEventActionsPopup>
						<ProfileAttributes v-if="rooms.roomIsSecure(rooms.currentRoom!.roomId)" :user="event.sender"></ProfileAttributes>
					</div>
				</div>
				<ReadReceipt :timestamp="event.origin_server_ts" :sender="event.sender"></ReadReceipt>
				<template v-if="event.plugin?.plugintype == PluginType.MESSAGE && event.content.msgtype == event.plugin.type">
					<!-- Plugin Message -->
					<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
				</template>
				<template v-else>
					<MessageSnippet v-if="inReplyTo" @click="onInReplyToClick" :event="inReplyTo" :showInReplyTo="true"></MessageSnippet>
					<Message v-if="event.content.msgtype == 'm.text'" :event="event" :users="users"></Message>
					<MessageSigned v-if="event.content.msgtype == 'pubhubs.signed_message'" :message="event.content.signed_message"></MessageSigned>
					<MessageFile v-if="event.content.msgtype == 'm.file'" :message="event.content"></MessageFile>
					<MessageImage v-if="event.content.msgtype == 'm.image'" :message="event.content"></MessageImage>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useHubSettings, useConnection, useUser } from '@/store/store';
	import { useMessageActions } from '@/store/message-actions';
	import MessageSnippet from './MessageSnippet.vue';
	import { useRooms } from '@/store/store';
	import { PluginType } from '@/store/plugins';
	import { M_MessageEvent, M_EventId } from '@/types/events';
	import { User as MatrixUser } from 'matrix-js-sdk';
	const hubSettings = useHubSettings();
	const connection = useConnection();
	const messageActions = useMessageActions();

	const pubhubs = usePubHubs();
	const users = ref([] as Array<MatrixUser>);

	const user = useUser();
	const rooms = useRooms();

	const props = defineProps<{ event: M_MessageEvent }>();

	onMounted(async () => {
		users.value = await pubhubs.getUsers();
	});

	const inReplyTo = structuredClone(props.event.content['m.relates_to']?.['m.in_reply_to']?.x_event_copy);

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: M_EventId): void;
	}>();

	const msgIsNotSend = computed(() => {
		return props.event.event_id.substring(0, 1) == '~';
	});

	function onInReplyToClick() {
		if (!inReplyTo) return;
		emit('inReplyToClick', inReplyTo.event_id);
	}

	function reply() {
		messageActions.replyingTo = undefined;
		messageActions.replyingTo = props.event;
	}

	// function avatar(user) {
	// 	const currentRoom = rooms.currentRoom;
	// 	return getUserAvatar(user, currentRoom);
	// }

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
