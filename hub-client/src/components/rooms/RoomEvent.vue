<template>
	<div v-if="hubSettings.isVisibleEventType(event.type) && hubSettings.skipNoticeUserEvent(event)" class="group flex flex-row space-x-4 mb-8">
		<Avatar :class="bgColor(color(event.sender))" :user="event.sender"></Avatar>
		<div class="w-3/5">
			<div class="flex items-center">
				<H3 :class="`${textColor(color(event.sender))} flex items-center mb-0`">
					<UserDisplayName :user="event.sender"></UserDisplayName>
					<EventTime class="ml-2" :timestamp="event.origin_server_ts"> </EventTime>
				</H3>
				<button @click="reply" class="ml-2 mb-1 hidden group-hover:block">
					<Icon :type="'reply'" :size="'sm'"></Icon>
				</button>
			</div>
			<H3>
				<ProfileAttributes :user="event.sender"></ProfileAttributes>
			</H3>
			<MessageSnippet v-if="isReply(event)" :event="inReplyTo" :showInReplyTo="true"></MessageSnippet>
			<Message v-if="msgTypeIsText" :message="event.content.body"></Message>
			<MessageHtml v-if="msgTypeIsHtml" :message="event.content.formatted_body"></MessageHtml>
			<MessageFile v-if="event.content.msgtype == 'm.file'" :message="event.content"></MessageFile>
			<MessageImage v-if="event.content.msgtype == 'm.image'" :message="event.content"></MessageImage>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useHubSettings } from '@/store/store';
	import { useUserColor } from '@/composables/useUserColor';
	import { useMessageActions } from '@/store/message-actions';
	import MessageSnippet from './MessageSnippet.vue';

	const hubSettings = useHubSettings();
	const { color, textColor, bgColor } = useUserColor();
	const messageActions = useMessageActions();

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
	});

	const inReplyTo = computed(() => props.event.content?.['m.relates_to']?.['m.in_reply_to']?.event_copy)

	function reply() {
		messageActions.replyingTo = undefined;
		messageActions.replyingTo = props.event;
	}

	function isReply(event: Record<string, any>): boolean {
		return event.content?.['m.relates_to']?.['m.in_reply_to']?.event_copy instanceof Object;
	}

    const msgTypeIsText = computed(() => {
		if (props.event.content.msgtype == 'm.text') {
			if (typeof props.event.content.format == 'undefined') {
				return true;
			}
		}
		return false;
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
</script>
