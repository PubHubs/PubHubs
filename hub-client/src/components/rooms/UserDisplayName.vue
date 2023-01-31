<template>
    <span>{{filters.matrixDisplayName(displayName)}}</span>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import filters from "../../core/filters";
    import { useRooms } from '@/store/store';

    const rooms = useRooms();

    const props = defineProps({
        user: {
            type: String,
            required:true,
        },
    });

    const displayName = computed(() => {
        const currentRoom = rooms.currentRoom;
        const member = currentRoom.getMember(props.user);
        if ( member!=null) {
            if ( member.user!=undefined && member.user.displayName!=undefined ) {
                return member.user.displayName;
            }
        }
        return props.user;
    })

</script>
