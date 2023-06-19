<template>
    <div class="flex justify-center items-center h-screen bg-gray-900 text-white">
        <div class="grid grid-cols-2 gap-10 max-w-4xl mx-auto p-10">
            <div class="flex flex-col justify-center gap-4">
                <p class="text-2xl font-semibold">{{ $t('rooms.secure_room_message') }}</p>
                <p class="text-lg">{{ $t('rooms.secure_room_attribute_info') }}</p>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-lg">Info</span>
                    <a href="https://www.yivi.app/" class="text-lg underline hover:text-blue-400">Yivi App</a>
                </div>
            </div>
            <div id="yivi-web-form" class="bg-gray-800 p-10 rounded">
                <!-- Content for the right column -->
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { onMounted } from 'vue';
    import { useRooms } from '@/store/store';
    import { usePubHubs } from '@/core/pubhubsStore';
    import { useRoute } from 'vue-router';

    const route = useRoute();

    const pubhubs = usePubHubs();
    const rooms = useRooms();

    onMounted(() => {
        const access_token = pubhubs.Auth.getAccessToken();
        rooms.yiviSecuredRoomflow(route.params.id as string, access_token);
    });
</script>
