<template>
	<figure class="flex aspect-square h-full w-full items-center justify-center overflow-hidden rounded-xl">
		<img v-show="imageLoaded" :src="url" @load="imageLoaded = true" :alt="`Icon of Hub ${hubNameForImgAlt ?? ''}`" class="h-full w-full bg-on-accent-primary object-cover" />
		<Icon v-if="fallback && !imageLoaded" type="hub_fallback" class="h-full w-full text-on-surface-variant" />
	</figure>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref } from 'vue';

	// Types
	type Props = {
		hubNameForImgAlt?: string; // Used when showing multiple Hubs.
		iconUrl: string;
		iconUrlDark: string;
		isActive?: boolean;
	};

	const props = defineProps<Props>();
	const url = computed(getUrl);

	let fallback = ref(false);
	let imageLoaded = ref(false);

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
