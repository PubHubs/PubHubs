<template>
    <li class="mb-2 menu-item" :class="activeClass">
        <Icon v-if="isSecuredRoom()" type="lock" class="cursor-pointer text-red ml-2 float-left"></Icon>
        <Icon v-else class="mr-4 float-left" :type="icon"></Icon>
        <TruncatedText><slot></slot></TruncatedText>
    </li>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { Room } from '@/store/rooms';
    import { useRooms } from '@/store/store';

    const rooms = useRooms();

    const props = defineProps({
        icon: {
            type: String,
            default: 'circle',
        },
        active: {
            type: Boolean,
            default: false,
        },
        roomInfo: {
            type: Room,
            default: true,
        },
    });

    const activeClass = computed(() => {
        if (props.active) {
            return 'text-blue hover:text-blue-dark';
        }
        return 'text-green hover:text-green-dark';
    });

    function isSecuredRoom() {
        if (rooms.roomIsSecure(props.roomInfo.roomId)) {
            return true;
        } else {
            return false;
        }
    }
</script>
