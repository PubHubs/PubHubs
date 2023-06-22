<template>
    <div class="block text-center mb-2 cursor-pointer relative" :class="colorClass[active]">
        <Badge v-if="hub && hub.unreadMessages>0" class="sm:ml-6">{{ hub.unreadMessages }}</Badge>
        <Icon :type="type" :size="size" class="mx-auto"></Icon>
        <img v-if="hub" v-show="logoLoaded" @load="imgLoadReady()" :src="hub.url + '/img/logo.svg'" :alt ="'logo of ' + hub.hubId" class="absolute z-10 h-16 w-16">
        <!-- <div v-if="hub" class="triangle border-green"></div> -->
    </div>
</template>

<script lang="ts">
    const colorClass = {
        false : 'text-blue',
        true : 'text-green',
    };
</script>

<script setup lang="ts">
    import { ref } from 'vue'

    const props = defineProps({
        type: {
            type: String,
            default: 'circle',
        },
        size: {
            type: String,
            default: '3xl',
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

    const logoLoaded = ref(false);

    function imgLoadReady(){
        logoLoaded.value = true;
    }
</script>


<style scoped>
    .triangle {
        position: absolute;
        left:53%;
        bottom:15%;
        border-bottom: 25px solid;
        border-right: 25px solid transparent;
    }
    img {
        top:50%;
        left:50%;
        transform: translate(-50%,-50%);
    }
</style>
