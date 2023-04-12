<template>
    <div class="flex h-screen">
        <div class="w-4/6 m-4">
            <Logo class="mb-8"></Logo>

            <H1 class="text-center">Homepage</H1>
            <p class="text-center" v-html="$t('home.welcome')"></p>
        </div>
    </div>
</template>

<script setup lang="ts">
    /**
     *
     * This HOME page will be shown if a user is authenticated in PubHubs Central.
     *
     */
</script>
