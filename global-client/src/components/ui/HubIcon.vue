<template>
    <div class="block group text-center mb-2 cursor-pointer relative" :class="active?'text-green':'text-blue'" :title="hub?hub.hubId:null">
        <Badge v-if="hub && hub.unreadMessages>0" class="sm:ml-6">{{ hub.unreadMessages }}</Badge>
        <Icon v-if="hub && !pinned" type="plus" class="text-green absolute right-0" @click.prevent="pin"></Icon>
        <Icon v-if="pinned" type="remove" class="text-red absolute right-0 hidden group-hover:block" @click.prevent="remove"></Icon>
        <Icon :type="type" :size="size" class="mx-auto"></Icon>
        <img v-if="hub" v-show="logoLoaded" @load="imgLoadReady()" :src="hub.url + '/img/logo.svg'" :alt ="hub.hubId" class="absolute z-10 h-16 w-16 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
    </div>
</template>

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
        pinned: {
            type: Boolean,
            default: false,
        },
        active: {
            type: Boolean,
            default: false,
        }
    });

    const emit = defineEmits(['pin','remove']);

    const logoLoaded = ref(false);

    function imgLoadReady(){
        logoLoaded.value = true;
    }


    function pin() {
        emit('pin');
    }

    function remove() {
        emit('remove');
    }

</script>
