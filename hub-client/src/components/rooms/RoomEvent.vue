<template>
	<div>
		<!-- Plugin Event -->
		<div v-if="event.plugin && event.plugin.plugintype == PluginType.EVENT && event.type == event.plugin.type">
			<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
		</div>
		<!-- Normal Event -->

		<div v-if="hubSettings.isVisibleEventType(event.type) && hubSettings.skipNoticeUserEvent(event)" class="group flex flex-row space-x-4 mb-8">
			<Avatar :class="bgColor(color(event.sender))" :userName="event.sender" :img="avatar(event.sender) ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatar(event.sender).slice(6) : ''"></Avatar>
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

				<template v-if="event.plugin?.plugintype == PluginType.MESSAGE && event.content.msgtype == event.plugin.type">
					<!-- Plugin Message -->
					<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
				</template>
				<template v-else>
					<MessageMention v-if="msgTypeIncludesMention" :message="event.content.body" :users="users"></MessageMention>
					<MessageSnippet v-if="inReplyTo" @click="onInReplyToClick" :event="inReplyTo" :showInReplyTo="true"></MessageSnippet>
					<Message v-if="msgShowBody && !msgTypeIncludesMention" :message="event.content.body" :users="users"></Message>
					<MessageSigned v-if="event.content.msgtype == 'pubhubs.signed_message'" :message="event.content.signed_message"></MessageSigned>
					<MessageHtml v-if="msgTypeIsHtml && !msgTypeIncludesMention" :message="(event.content as M_HTMLTextMessageEventContent).formatted_body"></MessageHtml>
					<MessageFile v-if="event.content.msgtype == 'm.file'" :message="event.content"></MessageFile>
					<MessageImage v-if="event.content.msgtype == 'm.image'" :message="event.content"></MessageImage>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';
	import { useUserAvatar } from '@/composables/useUserName';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useHubSettings, useConnection, useUser } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';
	import { useMessageActions } from '@/store/message-actions';
	import MessageSnippet from './MessageSnippet.vue';
	import { useRooms } from '@/store/store';
	import { PluginType } from '@/store/plugins';
	import { M_MessageEvent, M_HTMLTextMessageEventContent, M_EventId } from '@/types/events';
	import { User as MatrixUser } from 'matrix-js-sdk';
	const hubSettings = useHubSettings();
	const connection = useConnection();
	const { color, bgColor } = useUserColor();
	const messageActions = useMessageActions();

	const pubhubs = usePubHubs();
	const users = ref([] as Array<MatrixUser>);
	const { getUserAvatar } = useUserAvatar();

	const user = useUser();
	const rooms = useRooms();

	const supportedMsgTypes = ['m.text', 'm.image', 'm.file', 'pubhubs.signed_message'];

	const props = defineProps<{ event: M_MessageEvent }>();

	onMounted(async () => {
		if (rooms.currentRoomExists) {
			await rooms.storeRoomNotice(rooms.currentRoom!.roomId);
		}
		users.value = await pubhubs.getUsers();
	});

	const inReplyTo = structuredClone(props.event.content['m.relates_to']?.['m.in_reply_to']?.x_event_copy);

	//#region Events

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: M_EventId): void;
	}>();

	function onInReplyToClick() {
		if (!inReplyTo) return;
		emit('inReplyToClick', inReplyTo.event_id);
	}

	//call within call
	// call

	//#endregion

	//#region Computed properties

	const msgIsNotSend = computed(() => {
		return props.event.event_id.substring(0, 1) == '~';
	});

	const msgShowBody = computed(() => {
		return !supportedMsgTypes.includes(props.event.content.msgtype) || (props.event.content.msgtype == 'm.text' && !msgTypeIsHtml.value);
	});

	const msgTypeIsHtml = computed(() => {
		if (props.event.content.msgtype == 'm.text') {
			if (typeof props.event.content.format == 'string') {
				if (props.event.content.format == 'org.matrix.custom.html' && typeof props.event.content.formatted_body == 'string') {
					return true;
				}
			}
		}
		return false;
	});

	const msgTypeIncludesMention = computed(() => {
		if (props.event.content.msgtype == 'm.text') {
			if (props.event.content.body.includes('@')) {
				return true;
			}
		}
		return false;
	});

	//#endregion

	//#region Methods

	function reply() {
		messageActions.replyingTo = undefined;
		messageActions.replyingTo = props.event;
	}

	function avatar(user) {
		const currentRoom = rooms.currentRoom;
		return getUserAvatar(user, currentRoom);
	}

	function resend() {
		const pubhubs = usePubHubs();
		pubhubs.resendEvent(props.event);
	}

	const timerReady = ref(false);
	window.setTimeout(() => {
		timerReady.value = true;
	}, 1000);

	//#endregion
</script>
