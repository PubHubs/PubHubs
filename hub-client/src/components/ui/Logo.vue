<template>
	<img alt="PubHubs" :src="logo" />
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useSettings } from '@/store/settings';

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

	const logo = computed(() => {
		let theme = props.theme;
		if (theme == '') {
			theme = settings.getActiveTheme;
		}

		if (theme == 'dark') {
			return logoDark;
		}
		return logoLight;
	});
</script>
