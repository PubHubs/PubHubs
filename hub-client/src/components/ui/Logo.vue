<template>
	<img :alt="name" :src="logo" />
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useSettings } from '@/store/store';

	const logoLightUrl = '/img/logo.svg';
	const logoDarkUrl = '/img/logo-dark.svg';

	const settings = useSettings();

	const props = defineProps({
		theme: {
			type: String,
			default: '',
			validator(value: string) {
				return ['light', 'dark', ''].includes(value);
			},
		},
		global: {
			type: Boolean,
			default: false,
		},
		alt: {
			type: String,
			default: '',
		},
	});

	const setTheme = computed(() => {
		let theme = props.theme;
		if (theme === '') {
			theme = settings.getActiveTheme;
		}
		return theme;
	});

	const name = computed(() => {
		if (props.alt === '') {
			return settings.hub.name;
		}
		return props.alt;
	});

	const logo = computed(() => {
		let url = logoLightUrl;
		if (setTheme.value === 'dark') {
			url = logoDarkUrl;
		}

		//@ts-ignore
		if (typeof _env.TIMESTAMP !== 'undefined') {
			// @ts-ignore
			url += '?' + _env.TIMESTAMP;
		}

		if (props.global) {
			url = '/client' + url;
		}

		return url;
	});
</script>
