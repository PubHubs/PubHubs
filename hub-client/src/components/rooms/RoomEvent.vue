<template>
	<div v-if="hubSettings.isVisibleEventType(event.type) && hubSettings.skipNoticeUserEvent(event)" class="flex flex-row space-x-4 mb-8">
		<Avatar :class="bgColor(color(event.sender))" :user="event.sender"></Avatar>
		<div class="w-full">
			<H3 :class="textColor(color(event.sender))">
				<UserDisplayName :user="event.sender"></UserDisplayName>
				<EventTime class="ml-2" :timestamp="event.origin_server_ts"> </EventTime>
			</H3>
			<H3>
				<ProfileAttributes :user="event.sender"></ProfileAttributes>
			</H3>
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

	const hubSettings = useHubSettings();
	const { color, textColor, bgColor } = useUserColor();

	const props = defineProps({
		event: {
			type: Object,
			required: true,
		},
	});

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
