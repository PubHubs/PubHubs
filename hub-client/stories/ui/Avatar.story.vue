<template>
    <Story title="UI/Avatar">
        <Avatar :class="state.color" :img="state.image" :alt="state.image"></Avatar>
        <template #controls>
            <HstSelect v-model="state.color" title="Avatar Color" :options="colors" />
            <HstButtonGroup v-model="state.image" title="Image" :options="images" />
        </template>
    </Story>
</template>

<script setup lang="ts">
    import { reactive } from 'vue'
    import Avatar from '@/components/ui/Avatar.vue';

    const colors = ['bg-avatar-green','bg-avatar-purple','bg-avatar-yellow','bg-avatar-red','bg-avatar-lime','bg-avatar-blue','bg-avatar-orange'];
    const images = [
        { 'label': 'empty', 'value' : '' },
        { 'label': 'test' , 'value' : 'stories/assets/avatar-test.png' },
    ];

    const state = reactive({
        color:'bg-blue',
        image:'',
    })
</script>

