<template>
    <div class="m-2 cursor-pointer">
        <div class="bg-green p-4 rounded-md relative text-center overflow-hidden">
            <H3>{{ hub.hubId }}</H3>
            <img v-if="hub" :src="hub.url + '/img/logo.svg'" :alt ="'logo of ' + hub.hubId" class="h-16 w-16 mx-auto">
            <TruncatedText>{{ hub.description }}</TruncatedText>
        </div>
    </div>
</template>

<script setup lang="ts">

    const props = defineProps({
        hub: {
            type: Object,
            default: undefined
        },
    });
</script>
