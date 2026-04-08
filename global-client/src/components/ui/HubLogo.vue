<template>
	<div class="flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
		<img
			v-show="!fallback"
			:alt="'logo of ' + hubId"
			class="h-full w-full object-cover"
			:src="hubUrl + logoPath"
			@load="hideFallback"
		/>
		<Icon
			v-if="fallback"
			type="lightning-slash"
		/>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	const props = defineProps<{ hubUrl: string; hubId: string; changeToDark: boolean }>();
	const settings = useSettings();
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
