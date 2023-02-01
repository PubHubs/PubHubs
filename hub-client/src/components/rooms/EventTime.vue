<template>
    <span class="text-xs">{{ $d(new Date(timestamp),'long') }}</span>
</template>

<script setup lang="ts">
    defineProps({
        timestamp: {
            type:Number,
            required:true,
        },
    });
</script>
