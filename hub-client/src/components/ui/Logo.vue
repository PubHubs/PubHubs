<template>
	<img alt="PubHubs logo" :src="logoLightUrl" class="h-full w-full dark:hidden" />
	<img alt="PubHubs logo" :src="logoDarkUrl" class="hidden h-full w-full dark:block" />
</template>

<script setup lang="ts">
	// Assets
	const logoLightUrl = '/img/pubhubs-logo.svg';
	const logoDarkUrl = '/img/pubhubs-logo-dark.svg';
</script>
