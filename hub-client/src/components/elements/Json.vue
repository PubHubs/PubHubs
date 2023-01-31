<template>
    <pre class="font-mono text-sm p-1 bg-black text-white">{{JSON.stringify(json, null, 2)}}</pre>
</template>

<script setup lang="ts">
    defineProps({
        json: Object,
    });
</script>
