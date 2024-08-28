<template>
	<div>
		<!-- Plugin Event -->
		<div v-if="event.plugin && event.plugin.plugintype === PluginType.EVENT && event.type === event.plugin.type">
			<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
		</div>
		<!-- Normal Event -->
		<div v-else class="group flex gap-4 pl-6 pr-3 transition-all duration-150 ease-in-out hover:bg-lightgray-light hover:dark:bg-hub-background-2 py-4">
			<Avatar :userId="event.sender" :img="user.avatarUrlOfUser ? pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + user.avatarUrlOfUser.slice(6) : ''" :icon="true" :notMention="false" :fromHubSettings="false"></Avatar>
			<div class="w-4/5 xl:w-3/5">
				<div class="flex flex-wrap items-center">
					<div class="relative flex flex-wrap items-center w-full gap-x-2 md:w-fit pr-2 min-h-6">
						<UserDisplayName :user="event.sender"></UserDisplayName>
						<div class="flex gap-2 flex-wrap">
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
						<RoomEventActionsPopup>
							<button v-if="!msgIsNotSend" @click="reply" class="p-1 bg-gray-lighter hover:bg-gray-light dark:bg-gray-middle hover:dark:bg-gray-darker rounded-md">
								<Icon :type="'reply'" :size="'xs'"></Icon>
							</button>
							<router-link
								v-if="(!msgIsNotSend && user.isAdmin && event.sender !== user.user.userId) || true"
								:to="{ name: 'ask-disclosure', query: { user: event.sender } }"
								class="flex p-1 bg-gray-lighter hover:bg-gray-light dark:bg-gray-middle hover:dark:bg-gray-darker rounded-md"
								:title="$t('menu.moderation_tools_disclosure')"
							>
								<Icon :type="'warning'" :size="'xs'"></Icon>
							</router-link>
						</RoomEventActionsPopup>
						<ProfileAttributes v-if="props.roomType == RoomType.PH_MESSAGES_RESTRICTED" :user="event.sender" :room_id="event.room_id"></ProfileAttributes>
					</div>
				</div>
				<template v-if="event.plugin?.plugintype === PluginType.MESSAGE && event.content.msgtype === event.plugin.type">
					<!-- Plugin Message -->
					<component :is="event.plugin.component" :event="event">{{ event.plugin.component }}</component>
				</template>
				<template v-else>
					<MessageSnippet v-if="inReplyTo" @click="onInReplyToClick" :event="inReplyTo" :showInReplyTo="true"></MessageSnippet>
					<Message v-if="event.content.msgtype === 'm.text'" :event="event"></Message>
					<MessageSigned v-if="event.content.msgtype === 'pubhubs.signed_message'" :message="event.content.signed_message"></MessageSigned>
					<MessageFile v-if="event.content.msgtype === 'm.file'" :message="event.content"></MessageFile>
					<MessageImage v-if="event.content.msgtype === 'm.image'" :message="event.content"></MessageImage>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { RoomType, useConnection, useUser } from '@/store/store';
	import { useMessageActions } from '@/store/message-actions';
	import MessageSnippet from './MessageSnippet.vue';
	import { PluginType } from '@/store/plugins';
	import { TMessageEvent } from '@/model/model';

	const connection = useConnection();
	const messageActions = useMessageActions();

	const user = useUser();
	const pubhubs = usePubHubs();

	const props = defineProps<{ event: TMessageEvent; roomType: RoomType | undefined }>();

	const inReplyTo = structuredClone(props.event.content['m.relates_to']?.['m.in_reply_to']?.x_event_copy);

	const emit = defineEmits<{
		(e: 'inReplyToClick', inReplyToId: string): void;
	}>();

	const msgIsNotSend = computed(() => {
		return props.event.event_id.substring(0, 1) === '~';
	});

	function onInReplyToClick() {
		if (!inReplyTo) return;
		emit('inReplyToClick', inReplyTo.event_id);
	}

	function reply() {
		messageActions.replyingTo = undefined;
		messageActions.replyingTo = props.event;
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
