<template>
    <div class="flex h-screen">
        <div class="w-4/6 m-4">
            <Logo class="mb-8"></Logo>

            <H1 class="text-center">HubPage</H1>

            <Button class="w-3/6 m-auto" @click="login()">{{ $t("login.login") }}</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
    /**
     *
     * This HUB page will be shown if a user is not yet registered or authenticated in PubHubs Central
     *
     */

    import { inject } from 'vue';
    const pubhubs:any = inject('pubhubs');

    function login() {
        pubhubs.centralLogin();
    }

</script>
