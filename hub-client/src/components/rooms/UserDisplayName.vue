<template>
    <span>{{filters.matrixDisplayName(pubhubs.getUsersDisplayNameByID(user))}}</span>
</template>

<script setup lang="ts">
    import { inject } from 'vue';
    import filters from "../../core/filters";

    defineProps({
        user: {
            required:true,
        },
    });

    const pubhubs:any = inject('pubhubs');
</script>
