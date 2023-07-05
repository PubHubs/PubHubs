<template>
    <div v-if="hubSettings.isVisibleEventType(event.type) && skipNoticeUserEvent(event)" class="flex flex-row space-x-4 mb-8">
        <Avatar :class="bgColor(userColor)"></Avatar>
        <div  class="w-full">
            <H3 :class="textColor(userColor)">
                <UserDisplayName :user="event.sender"></UserDisplayName>
                <EventTime class="ml-2" :timestamp="event.origin_server_ts"> </EventTime>
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

    // Notice user event is skipped. We don't see notice at the top
    function skipNoticeUserEvent(event: any) {
        
        
        return String(event.sender).includes("@notices") ? false : true;
    }


    const userColor = color(props.event.sender);
</script>
