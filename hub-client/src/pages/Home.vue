<template>
    <div class="flex h-screen">
        <div class="w-4/6 m-4">
            <Logo class="mb-8"></Logo>
            <p class="text-center" v-html="$t('home.welcome')"></p>
        </div>
    </div>
</template>

<script setup lang="ts">
    import Logo from '@/components/ui/Logo.vue'
</script>
