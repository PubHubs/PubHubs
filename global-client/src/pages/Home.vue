<template>
    <div class="flex h-screen">
        <div class="w-2/6 m-4 text-center mx-auto">
            <Logo class="mt-8"></Logo>
            <H1 class="text-center">Central</H1>
            <p class="text-center" v-html="$t('home.welcome')"></p>

            <Button v-if="!global.loggedIn" class="mt-8" @click="global.login()">{{ $t('login.global_login') }}</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
    import { useGlobal } from '@/store/store'
    const global = useGlobal();
</script>

