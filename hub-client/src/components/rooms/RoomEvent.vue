<template>
    <div v-if="hubSettings.isVisibleEventType(event.type)" class="flex flex-row space-x-4 mb-8">
        <ProfileAttributes v-if="event.content.msgtype == 'm.notice'" :attribute="event.content.body"></ProfileAttributes>
        <Avatar :class="bgColor(userColor)"></Avatar>
        <div class="w-full">
            <H3 :class="textColor(userColor)">
                <UserDisplayName v-if="skipNoticeUserEvent(event)" :user="event.sender"></UserDisplayName>
                <EventTime class="ml-2" v-if="skipNoticeUserEvent(event)" :timestamp="event.origin_server_ts"> </EventTime>
            </H3>  
            <Message v-if="event.content.msgtype == 'm.text'" :message="event.content.body"></Message>
            <MessageFile v-if="event.content.msgtype == 'm.file'" :message="event.content"></MessageFile>
            <MessageImage v-if="event.content.msgtype == 'm.image'" :message="event.content"></MessageImage>
        </div>
    </div>
</template>

<script setup lang="ts">
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

    // Notice user event is skipp
    function skipNoticeUserEvent(event: any) {
        if (String(event.sender) === "@notices_user:testhub.matrix.host") { 
            return false;
        }
        return true;   
    }

    const userColor = color(props.event.sender);
</script>
