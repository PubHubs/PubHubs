<template>
    <Story title="Elements/Icon">
        <div class="grid border-b-2 mb-2 dark:text-white" :class="'grid-cols-'+(sizeKeys.length+1)">
            <div></div>
            <div v-for="size in sizeKeys" :key="size">
                <h2 class="dark:text-white">{{size}}</h2>
            </div>
        </div>
        <div v-for="type in iconKeys" :key="type">
            <div class="grid mb-2" :class="'grid-cols-'+(sizeKeys.length+1)">
                <div><h2 class="dark:text-white">{{type}}</h2></div>
                <div v-for="size in sizeKeys" :key="size">
                    <Icon :type="type" :size="size" class="dark:text-green"></Icon>
                </div>
            </div>
        </div>
    </Story>
</template>

<script setup lang="ts">
    // import { reactive } from 'vue'
    import {icons,sizes} from '@/assets/icons';
    import Icon from '@/components/elements/Icon.vue';

    const iconKeys = Object.keys(icons);
    const sizeKeys = Object.keys(sizes);

    // const state = reactive({
    //     type:'circle',
    //     size:'base',
    // })
</script>
