<template>
	<img
		alt="PubHubs logo"
		class="h-full w-full object-contain dark:hidden"
		:src="logoLightUrl"
	/>
	<img
		alt="PubHubs logo"
		class="hidden h-full w-full object-contain dark:block"
		:src="logoDarkUrl"
	/>
</template>

<script lang="ts" setup>
	// Assets
	const logoLightUrl = `${import.meta.env.BASE_URL}img/logo.svg`;
	const logoDarkUrl = `${import.meta.env.BASE_URL}img/logo-dark.svg`;
</script>
