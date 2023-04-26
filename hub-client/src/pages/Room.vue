<template>
    <HeaderFooter v-if="rooms.currentRoomExists" class="pl-3">
        <template #header>
            <div class="flex">
                <Icon type="room" class="text-blue mt-2" size="lg"></Icon>
                <div class="pl-3">
                    <H1 class="m-0 text-blue font-bold">{{ $t("rooms.title",[rooms.currentRoom.name]) }}</H1    >
                    <p class="text-sm leading-4">Deze room gaat over .... Lorem ipsum dolor sit amet, consetetur sadipscing elitr.</p>
                </div>
                <SearchInput class="ml-16 mt-6 flex-auto" @submit="search"></SearchInput>
            </div>
        </template>

        <RoomTimeline class="pt-12" :room_id="rooms.currentRoomId"></RoomTimeline>

        <template #footer>
            <MessageInput @submit="addMessage($event)"></MessageInput>
        </template>
    </HeaderFooter>
</template>

<script setup lang="ts">
    import { inject,onMounted, watch } from 'vue';
    import { useRoute } from 'vue-router'
    import { useI18n } from 'vue-i18n';

    import { useRooms } from '@/store/store'
    const rooms = useRooms();
    const pubhubs:any = inject('pubhubs');
    const route = useRoute();
    const { t } = useI18n();


    onMounted( () => {
        rooms.changeRoom(route.params.id as string);
    })

    watch(route, () => {
        rooms.changeRoom(route.params.id as string);
    })

    function addMessage(text:string) {
        pubhubs.addMessage(rooms.currentRoomId,text);
    }

    function search(term:string) {
        alert(t('others.nop') + '['+term+']');
    }


</script>
