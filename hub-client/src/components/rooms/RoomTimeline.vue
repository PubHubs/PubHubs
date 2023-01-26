<template>
    <div class="room-timeline relative">
        <div class="fixed right-3">
            <OldEventsLoader class="" v-if="!roomPaginationEnded" :room_id="room_id"></OldEventsLoader>
        </div>
        <RoomEvent v-for="item in rooms.rooms[room_id].timeline" :key="item.event.eventId" :event="item.event"></RoomEvent>
    </div>
</template>

<script setup lang="ts">
    import { ref, onBeforeUpdate } from 'vue';
    import { useRooms } from '@/store/store'

    const rooms = useRooms();

    const props = defineProps({
        room_id: {
            type: String,
            required: true,
        },
    });

    let roomPaginationEnded = ref(false);

    onBeforeUpdate(()=>{
        roomPaginationEnded.value = (rooms.rooms[props.room_id].timeline[0].event.type=='m.room.create' );
    })
</script>
