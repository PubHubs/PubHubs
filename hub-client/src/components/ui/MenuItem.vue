<template>
    <li class="mb-2 menu-item" :class="activeClass">
        <Icon class="mr-4 float-left" :type="icon"></Icon>
        <TruncatedText><slot></slot></TruncatedText>
    </li>
</template>

<script setup lang="ts">
    import { computed } from "vue";

    const props = defineProps({
        icon: {
            type: String,
            default: 'circle',
        },
        active: {
            type: Boolean,
            default: false,
        }
    });

    const activeClass = computed(() => {
        if (props.active) {
            return 'text-blue hover:text-blue-dark';
        }
        return 'text-green hover:text-green-dark';
    })
</script>
