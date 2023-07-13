<template>
    <div v-if="hubs.currentHubId && ! global.existsInPinnedHubs(hubs.currentHubId)">
        <HubIcon :hub="hubs.currentHub" :active="true" :pinnable="global.loggedIn" @pin="global.addPinnedHub( hubs.currentHub, 0 )"></HubIcon>
        <Line v-if="global.hasPinnedHubs" class="m-2 sm:m-6 mt-8"></Line>
    </div>
    <draggable :list="global.pinnedHubs" :item-key="'hubId'">
        <template #item="{element,index}">
            <router-link :to="{ name: 'hub', params: { 'id':element.hubId } }" v-slot="{ isActive }">
                <HubIcon v-if="global.loggedIn || element.hubId==hubs.currentHubId" :hub="hubs.hub(element.hubId)" :active="isActive" :pinned="true" @remove="global.removePinnedHub( index )"></HubIcon>
            </router-link>
        </template>
    </draggable>
</template>

<script setup lang="ts">
    import draggable from "vuedraggable";
    import { useGlobal, useHubs } from '@/store/store'

    const global = useGlobal();
    const hubs = useHubs();

</script>
