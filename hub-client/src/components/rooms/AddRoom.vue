<template>
    <TextInput :placeholder="$t('rooms.search')" :visible="false" @update="addNewRoom($event)" @changed="findPublicRooms($event)" @cancel="findPublicRooms('')"></TextInput>

    <ul v-if="hasPublicRooms" class="bg-white rounded-lg p-2">
        <li v-for="room in publicRooms" :key="room.room_id" class="flex flex-row cursor-pointer" @click="joinPublicRoom(room.room_id)">
            <span class="bg-green rounded-lg p-2 m-1">{{room.name}}</span>
        </li>
    </ul>
</template>

<script setup lang="ts">
    import { inject, computed, ref } from 'vue';
    import { Room } from '@/store/store';

    const pubhubs:any = inject('pubhubs');

    let publicRooms = ref<Room[]>([]);

    const hasPublicRooms = computed( () => {
        return publicRooms.value.length>0;
    });

    function findPublicRooms(search:string) {
        if ( !search ) search = "";
        publicRooms.value = [];
        if ( search!="" ) {
            pubhubs.getPublicRooms(search).then((response:any) => {
                publicRooms.value = response.chunk;
            });
        }
    }

    function joinPublicRoom(roomId:string) {
        publicRooms.value=[];
        pubhubs.joinRoom(roomId);
    }

    function addNewRoom(name:string) {
        pubhubs.newRoom({
            name: name,
        });
    }

</script>
