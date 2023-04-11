<template>
    <div class="block text-center mb-2 cursor-pointer relative" :class="colorClass[active]">
        <Badge v-if="hub && hub.unreadMessages>0">{{ hub.unreadMessages }}</Badge>
        <Icon :type="type" size="3xl" class="mx-auto"></Icon>
        <img v-if="hub" :src="hub.url + '/img/logo.svg'" :alt ="'logo of ' + hub.hubId" class="absolute z-10 h-16 w-16 left-8 top-2">
    </div>
</template>

<script lang="ts">
    const colorClass = {
        false : 'text-blue',
        true : 'text-green',
    };
</script>

<script setup lang="ts">

    const props = defineProps({
        type: {
            type: String,
            default: 'circle',
        },
        hub: {
            type: Object,
            default: undefined
        },
        active: {
            type: Boolean,
            default: false,
        }
    });

</script>
