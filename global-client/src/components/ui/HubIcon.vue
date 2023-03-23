<template>
    <div class="block text-center mb-2 cursor-pointer" :class="colorClass[active]">
        <Badge v-if="hub && hub.unreadMessages>0">{{ hub.unreadMessages }}</Badge>
        <Icon :type="type" size="4xl" class="mx-auto"></Icon>
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
