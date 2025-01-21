<template>
	<div class="h-full w-full rounded-md overflow-hidden flex justify-center items-center">
		<img class="h-full w-full object-cover" v-show="!fallback" :src="hubUrl + logoPath" @load="hideFallback" :alt="'logo of ' + hubId" />
		<Icon v-if="fallback" type="hub_fallback"></Icon>
	</div>
</template>

<script setup lang="ts">
	import { useSettings } from '@/store/store';
	import { computed, ref } from 'vue';

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
