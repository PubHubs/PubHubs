<template>
	<div v-if="hubSettings.isVisibleEventType(event.type) && hubSettings.skipNoticeUserEvent(event)" class="group flex flex-row space-x-4 mb-8">
		<Avatar :class="bgColor(color(event.sender))" :userName="event.sender" :img="avatar(event.sender) ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + avatar(event.sender).slice(6) : ''"></Avatar>
		<div class="w-3/5">
			<div class="flex items-center">
				<H3 :class="`${textColor(color(event.sender))} flex items-center mb-0`">
					<UserDisplayName :user="event.sender"></UserDisplayName>
					<EventTime class="ml-2" :timestamp="event.origin_server_ts"> </EventTime>
				</H3>
				<button v-if="!msgIsNotSend" @click="reply" class="ml-2 mb-1 hidden group-hover:block">
					<Icon :type="'reply'" :size="'sm'"></Icon>
				</button>
				<template v-if="timerReady">
					<button v-if="msgIsNotSend && connection.isOn" @click="resend()" class="ml-2 mb-1" :title="$t('errors.resend')">
						<Icon type="refresh" size="sm" class="text-red"></Icon>
					</button>
					<Icon v-if="msgIsNotSend && !connection.isOn" type="lost-connection" size="sm" class="ml-2 mb-1 text-red"></Icon>
				</template>
			</div>
			<H3>
				<ProfileAttributes v-if="rooms.roomIsSecure(rooms.currentRoom.roomId)" :user="event.sender"></ProfileAttributes>
			</H3>
			<MessageMention v-if="msgTypeIncludesMention" :message="event.content.body" :users="users"></MessageMention>
			<button><MessageSnippet v-if="inReplyTo" :event="inReplyTo" :showInReplyTo="true" @click="onInReplyToClick"></MessageSnippet></button>
			<Message v-if="msgShowBody && !msgTypeIncludesMention" :message="event.content.body" :users="users"></Message>
			<MessageSigned v-if="event.content.msgtype == 'pubhubs.signed_message'" :message="event.content.signed_message"></MessageSigned>
			<MessageHtml v-if="msgTypeIsHtml && !msgTypeIncludesMention" :message="(event.content as M_HTMLTextMessageEventContent).formatted_body"></MessageHtml>
			<MessageFile v-if="event.content.msgtype == 'm.file'" :message="event.content"></MessageFile>
			<MessageImage v-if="event.content.msgtype == 'm.image'" :message="event.content"></MessageImage>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { useUserAvatar } from '@/composables/useUserName';
	import { computed, onMounted, ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { useHubSettings, useConnection } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';
	import { useMessageActions } from '@/store/message-actions';
	import MessageSnippet from './MessageSnippet.vue';
	import { useRooms } from '@/store/store';
	import { M_MessageEvent, M_HTMLTextMessageEventContent, M_EventId } from '@/types/events';
	import { User as MatrixUser } from 'matrix-js-sdk';

	const hubSettings = useHubSettings();
	const connection = useConnection();
	const { color, textColor, bgColor } = useUserColor();
	const messageActions = useMessageActions();

	const pubhubs = usePubHubs();
	const users = ref([] as Array<MatrixUser>);
	const { getUserAvatar } = useUserAvatar();

	const rooms = useRooms();

	const supportedMsgTypes = ['m.text', 'm.image', 'm.file', 'pubhubs.signed_message'];

	onMounted(async () => {
		if (rooms.currentRoomExists) {
			await rooms.storeRoomNotice(rooms.currentRoom!.roomId);
		}
		users.value = await pubhubs.getUsers();
	});

	const props = defineProps<{ event: M_MessageEvent }>();

	const inReplyTo = structuredClone(props.event.content['m.relates_to']?.['m.in_reply_to']?.x_event_copy);

	//#region Events

	const emit = defineEmits<{
		(e: 'inReplyToClicked', inReplyToId: M_EventId): void
	}>();

	function onInReplyToClick() {
		if (!inReplyTo) return;
		emit('inReplyToClicked', inReplyTo.event_id);
	}

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
