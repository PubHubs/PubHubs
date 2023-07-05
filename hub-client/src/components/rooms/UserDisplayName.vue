<template>
    <span>{{ filters.matrixDisplayName(displayName) }}</span>
    <span v-if="attribute != ''" class="ml-2">
        <span class="text-white font-bold rounded-full p-2" style="background-color: rgb(247, 160, 9)">{{ attribute }}</span>
    </span>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import filters from '../../core/filters';
    import { useRooms } from '@/store/store';


    const rooms = useRooms();
    const props = defineProps({
        user: {
            type: String,
            required: true,
        },
            
    });

    const displayName = computed(() => {
        const currentRoom = rooms.currentRoom;
        const member = currentRoom.getMember(props.user);
    
        if (member != null) {
            if (member.user != undefined && member.user.displayName != undefined) {
                return member.user.displayName;
            }
        }
        return props.user;
    });
    const attribute = computed(() => {
        const currentRoom = rooms.currentRoom;
        return rooms.getBadgeInSecureRoom(currentRoom.roomId,displayName.value);
    });

</script>
