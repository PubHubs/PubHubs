<template>
	<img alt="PubHubs logo" :src="logoLightUrl" class="h-full w-full object-contain dark:hidden" />
	<img alt="PubHubs logo" :src="logoDarkUrl" class="hidden h-full w-full object-contain dark:block" />
</template>

<script setup lang="ts">
	// Assets
	const logoLightUrl = '/client/img/logo.svg';
	const logoDarkUrl = '/client/img/logo-dark.svg';
</script>
