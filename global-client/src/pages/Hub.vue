<template>
    <iframe v-if="hubs.currentHubExists" :src="hubs.currentHub.url" class="w-full h-full" name="hub" :id="iframeHubId"></iframe>
</template>

<script setup lang="ts">
    import { onMounted, watch } from 'vue';
    import { useRoute } from 'vue-router'
    import { iframeHubId, useHubs } from '@/store/store'

    const route = useRoute();
    const hubs = useHubs();

    onMounted( () => {
        hubs.changeHub(route.params);
    })

    watch(route, () => {
        hubs.changeHub(route.params);
    })

</script>
