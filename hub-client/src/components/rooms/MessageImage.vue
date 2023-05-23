<template>
    <img :alt="message.body"
         :src="pubhubs?.getBaseUrl() + '/_matrix/media/r0/download/' + message.url.slice(6)"
         class="max-w-full h-auto">
</template>

<script setup lang="ts">
    import {inject} from "vue";
    import {PubHubs} from "@/core/pubhubs";

    const pubhubs: PubHubs | undefined = inject("pubhubs");

    const props = defineProps({
        message: {
            type: Object,
            required:true,
        },
    });
</script>
