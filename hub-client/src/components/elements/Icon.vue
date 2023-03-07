<template>
    <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        :class="sizes[size]"
        v-html="icons[type]"
        >
    </svg>
</template>

<script lang="ts">
    import {icons,sizes} from '@/assets/icons';
</script>

<script setup lang="ts">
    defineProps({
        type : {
            type: String,
            default: 'empty',
            validator(value:string) {
                return Object.keys(icons).includes(value);
            }
        },
        size : {
            type: String,
            default: 'base',
            validator(value:string) {
                return Object.keys(sizes).includes(value);
            }
        },
    });
</script>
