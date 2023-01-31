<template>
    <HeaderFooter v-if="rooms.currentRoomExists">
        <template #header>
            <H1>{{ $t("rooms.title",[rooms.currentRoom.name]) }}</H1>
        </template>

        <RoomTimeline class="pt-12" :room_id="rooms.currentRoomId"></RoomTimeline>

        <template #footer>
            <LineInput :placeholder="$t('rooms.new_message')" @update="addMessage($event)"></LineInput>
        </template>
    </HeaderFooter>
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
