<template>
    <Menu v-if="rooms.hasRooms">
        <template v-for="room in rooms.sortedRoomsArray">
            <div v-if="!room.hidden" :key="room.roomId">
                <Icon v-if="edit" type="unlink" class="cursor-pointer text-red ml-2 float-right" @click="leaveRoom(room.roomId)"></Icon>
                <router-link :to="{ name: 'room', params: { id: room.roomId } }" v-slot="{ isActive }">
                    <Badge v-if="room.unreadMessages>0" class="-ml-1 -mt-1">{{room.unreadMessages}}</Badge>
                    <MenuItem icon="room" :active="isActive">
                        {{ room.name }}
                    </MenuItem>
                </router-link>
            </div>
        </template>
    </Menu>
    <AddRoom v-if="edit"></AddRoom>
</template>

<script setup lang="ts">
    import { inject } from 'vue';
    import { useI18n } from 'vue-i18n';
    import { useRooms, Message,MessageType,useMessageBox } from '@/store/store';

    const { t } = useI18n();

    const props = defineProps({
        edit : {
            type: Boolean,
            default: false,
        },
    });

    const rooms = useRooms();
    const pubhubs:any = inject('pubhubs');

    function leaveRoom(roomId:string) {
        const messsagebox = useMessageBox();
        messsagebox.dialog( new Message(MessageType.DialogStart,t('rooms.leave_sure')) ).then((answer)=> {
            if (answer) {
                pubhubs.leaveRoom(roomId);
            }
        });
    }

</script>
