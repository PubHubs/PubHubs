<template>
	<figure class="flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-ph-background-4">
		<img v-show="imageLoaded" :src="url" @load="imageLoaded = true" :alt="`Icon of Hub ${hubNameForImgAlt ?? ''}`" class="h-full w-full object-contain" />
		<Icon v-if="fallback && !imageLoaded" type="hub_fallback"></Icon>
	</figure>
</template>

<script setup lang="ts">
	import { Theme, useSettings } from '@/logic/store/settings';
	import { computed, onMounted, ref } from 'vue';

	const settings = useSettings();

	type Props = {
		iconUrl: string;
		iconUrlDark: string;
		// Used when showing multiple Hubs.
		hubNameForImgAlt?: string;
	};
	const props = defineProps<Props>();
	let fallback = ref(false);
	let imageLoaded = ref(false);

	const url = computed(getUrl);

	onMounted(() => {
		// Prevent the fallback quickly showing before the image is loaded
		setTimeout(showFallback, 500);
	});

	function showFallback() {
		if (!imageLoaded.value) {
			fallback.value = true;
		}
	}

	function getUrl(): string {
		switch (settings.getActiveTheme) {
			case Theme.Dark:
				return props.iconUrlDark;
			case Theme.Light:
				return props.iconUrl;
		}
	}
</script>
