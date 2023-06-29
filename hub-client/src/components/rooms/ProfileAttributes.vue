<template>
    <div></div>
</template>

<script setup lang="ts">
    import { onMounted} from 'vue';
    import { useRooms } from '@/store/store';
    const rooms = useRooms();
    const props = defineProps({
        attribute: {
            type: String,
            required: true,
        },
    });



onMounted(() => {
        rooms.createAttributeRelation(rooms.currentRoom.roomId, props.attribute);
    });
</script>
