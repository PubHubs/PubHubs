<template>
    <li class="mb-2">
        <Icon class="text-green hover:text-green-dark mr-4 float-left" :type="icon"></Icon>
        <TruncatedText><slot></slot></TruncatedText>
    </li>
</template>
<script setup lang="ts">
    defineProps({
        icon: {
            type: String,
            default: 'circle',
        },
    });
</script>
