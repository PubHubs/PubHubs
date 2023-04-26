<template>
    <Story title="UI/Menu & MenuItem">
        <Menu>
            <MenuItem icon="home">Home</MenuItem>
            <MenuItem active="true">Default & Active</MenuItem>
            <MenuItem :icon="state.icon">Item</MenuItem>
            <MenuItem :icon="state.icon">Very long menu item too see what needs to be done with these very long items</MenuItem>
        </Menu>
        <template #controls>
            <HstSelect v-model="state.icon" title="Icon" :options="iconKeys" />
        </template>
    </Story>
</template>

<script setup lang="ts">
    import { reactive } from 'vue'
    import {icons} from '@/assets/icons';
    import Menu from '@/components/ui/Menu.vue';
    import MenuItem from '@/components/ui/MenuItem.vue';

    const iconKeys = Object.keys(icons);

    const state = reactive({
        icon:'circle',
    })
</script>

