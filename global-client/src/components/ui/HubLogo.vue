<template>
	<div class="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
		<img class="h-full w-full object-cover" v-show="!fallback" :src="hubUrl + logoPath" @load="hideFallback" :alt="'logo of ' + hubId" />
		<Icon v-if="fallback" type="lightning-slash" />
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const props = defineProps<{ hubUrl: string; hubId: string; changeToDark: boolean }>();
	let fallback = ref(true);

	const logoPath = computed(() => {
		if (settings.getActiveTheme === 'dark' && props.changeToDark) {
			return '/img/logo-dark.svg';
		} else {
			return '/img/logo.svg';
		}
	});

	function hideFallback() {
		fallback.value = false;
	}
</script>
