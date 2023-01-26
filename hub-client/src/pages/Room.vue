<template>
    <div>
        <div v-if="rooms.currentRoomExists">
            <div class="fixed">
                <H1>{{ $t("rooms.title",[rooms.currentRoom.name]) }}</H1>
            </div>

            <RoomTimeline class="pt-12" :room_id="rooms.currentRoomId"></RoomTimeline>
            <LineInput :placeholder="$t('rooms.new_message')" @update="addMessage($event)"></LineInput>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { inject,onMounted, watch } from 'vue';
    import { useRoute } from 'vue-router'

    import { useRooms } from '@/store/store'
    const rooms = useRooms();
    const pubhubs:any = inject('pubhubs');
    const route = useRoute();

    function addMessage(text:string) {
        pubhubs.addMessage(rooms.currentRoomId,text);
    }

    onMounted( () => {
        rooms.changeRoom(route.params.id as string);
    })

    watch(route, () => {
        rooms.changeRoom(route.params.id as string);
    })

</script>
