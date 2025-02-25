<template>
	<img alt="PubHubs logo" :src="logoUrl" />
</template>

<script setup lang="ts">
	import { Theme, useSettings } from '@/logic/store/settings';
	import { computed } from 'vue';

	const logoLightUrl = '/client/img/logo.svg';
	const logoDarkUrl = '/client/img/logo-dark.svg';

	const settings = useSettings();

	const logoUrl = computed(() => {
		if (settings.getActiveTheme === Theme.Dark) {
			return logoDarkUrl;
		} else {
			return logoLightUrl;
		}
	});
</script>
