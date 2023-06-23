<template>
    <Menu v-if="rooms.hasRooms">
        <template v-for="room in rooms.sortedRoomsArray">
            <div v-if="!room.hidden" :key="room.roomId">
                <Icon v-if="edit" type="unlink" class="cursor-pointer text-red ml-2 float-right" @click="leaveRoom(room.roomId)"></Icon>
                <router-link :to="{ name: 'room', params: { id: room.roomId } }" v-slot="{ isActive }">
                    <Badge v-if="room.unreadMessages > 0" class="-ml-1 -mt-1">{{ room.unreadMessages }}</Badge>
                    <MenuItem :roomInfo="room" icon="room" :active="isActive">
                        {{ room.name }}
                    </MenuItem>
                </router-link>
            </div>
        </template>
    </Menu>
    <AddRoom v-if="edit"></AddRoom>
</template>

<script setup lang="ts">
    import { useI18n } from 'vue-i18n';
    import { useRooms, useDialog } from '@/store/store';
    import { usePubHubs } from '@/core/pubhubsStore';

    const { t } = useI18n();
    const rooms = useRooms();
    const pubhubs = usePubHubs();

    const props = defineProps({
        edit: {
            type: Boolean,
            default: false,
        },
    });

    async function leaveRoom(roomId: string) {
        const dialog = useDialog();
        if (await dialog.okcancel(t('rooms.leave_sure'))) {
            pubhubs.leaveRoom(roomId);
        }
    }
</script>
