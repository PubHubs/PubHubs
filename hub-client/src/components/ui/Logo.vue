<template>
	<img alt="PubHubs" :src="logo" />
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useSettings } from '@/store/store';

	import logoLight from '@/assets/pubhubs-logo.svg';
	import logoDark from '@/assets/pubhubs-logo-dark.svg';

	const settings = useSettings();

	const props = defineProps({
		theme: {
			type: String,
			default: '',
			validator(value: string) {
				return ['light', 'dark', ''].includes(value);
			},
		},
	});

	const setTheme = computed(() => {
		let theme = props.theme;
		if (theme == '') {
			theme = settings.getActiveTheme;
		}
		return theme;
	});

	const logo = computed(() => {
		if (setTheme.value == 'dark') {
			return logoDark;
		}
		return logoLight;
	});
</script>
