<template>
	<figure class="h-[10svh] min-h-[90px] w-full">
		<img v-if="props.bannerUrl" v-show="imageLoaded" :src="props.bannerUrl" @load="imageLoaded = true" :alt="`Banner of Hub ${hubNameForImgAlt ?? ''}`" class="h-full w-full object-cover" />
		<img v-else v-show="imageLoaded" :src="defaultUrl" @load="imageLoaded = true" :alt="`Banner of Hub ${hubNameForImgAlt ?? ''}`" class="h-full w-full object-cover" />
		<Icon v-if="fallback && !imageLoaded" type="hub_fallback"></Icon>
	</figure>
</template>

<script setup lang="ts">
	import { onMounted, ref } from 'vue';

	type Props = {
		bannerUrl?: string;
		// Used when showing multiple Hubs.
		hubNameForImgAlt?: string;
	};
	const props = defineProps<Props>();
	let fallback = ref(false);
	let imageLoaded = ref(false);
	const defaultUrl = 'client/img/banner.svg';

	onMounted(() => {
		// Prevent the fallback quickly showing before the image is loaded
		setTimeout(showFallback, 500);
	});

	function showFallback() {
		if (!imageLoaded.value) {
			fallback.value = true;
		}
	}
</script>
