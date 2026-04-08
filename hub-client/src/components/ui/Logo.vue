<template>
	<img
		alt="PubHubs logo"
		class="h-full w-full dark:hidden"
		:src="logoLightUrl"
	/>
	<img
		alt="PubHubs logo"
		class="hidden h-full w-full dark:block"
		:src="logoDarkUrl"
	/>
</template>

<script lang="ts" setup>
	// Assets
	const logoLightUrl = '/img/pubhubs-logo.svg';
	const logoDarkUrl = '/img/pubhubs-logo-dark.svg';
</script>
