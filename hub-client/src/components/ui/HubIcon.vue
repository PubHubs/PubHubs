<template>
	<figure class="flex aspect-square h-full w-full items-center justify-center overflow-hidden rounded-md">
		<img v-show="imageLoaded" :src="url" @load="imageLoaded = true" :alt="`Icon of Hub ${hubNameForImgAlt ?? ''}`" class="h-full w-full bg-white object-contain" />
		<Icon v-if="fallback && !imageLoaded" type="hub_fallback" class="h-full w-full text-ph-text"></Icon>
	</figure>
</template>

<script setup lang="ts">
	import { Theme, useSettings } from '@/logic/store/settings';
	import { computed, onMounted, ref } from 'vue';

	const settings = useSettings();

	type Props = {
		hubNameForImgAlt?: string; // Used when showing multiple Hubs.
		iconUrl: string;
		iconUrlDark: string;
		isActive?: boolean;
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
		return props.iconUrl;
	}
</script>
