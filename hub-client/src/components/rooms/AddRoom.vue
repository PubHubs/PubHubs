<template>
    <TextInput :placeholder="$t('rooms.search')" :visible="false" @submit="addNewRoom($event)" @changed="findPublicRooms($event)" @cancel="findPublicRooms('')"></TextInput>

    <ul v-if="hasPublicRooms" class="bg-white rounded-lg p-2">
        <li v-for="room in publicRooms" :key="room.roomId" class="flex flex-row cursor-pointer" @click="joinPublicRoom(room.room_id)">
            <span class="bg-green rounded-lg p-2 m-1">{{room.name}}</span>
        </li>
    </ul>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { Room } from '@/store/store';
    import { usePubHubs } from '@/core/pubhubsStore';

    let publicRooms = ref<Room[]>([]);
    const pubhubs = usePubHubs();

    const hasPublicRooms = computed( () => {
        return publicRooms.value.length>0;
    });

    async function findPublicRooms(search:string) {
        if ( !search ) search = "";
        publicRooms.value = [];
        if ( search !== "" ) {
            const response = await pubhubs.getPublicRooms(search)
            publicRooms.value = response.chunk as [];
        }
    }

    function joinPublicRoom(roomId:string) {
        publicRooms.value=[];
        pubhubs.joinRoom(roomId);
    }

    function addNewRoom(name:string) {
        pubhubs.newRoom({
            name: name,
            visibility: "public"
        });
    }

</script>
