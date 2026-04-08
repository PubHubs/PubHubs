<template>
	<figure class="rounded-base flex aspect-square h-full w-auto items-center justify-center overflow-hidden">
		<img
			v-show="imageLoaded"
			:alt="`Icon of Hub ${hubNameForImgAlt ?? ''}`"
			class="bg-surface-base dark:bg-on-surface h-full w-full object-cover"
			:src="url"
			@load="imageLoaded = true"
		/>
		<Icon
			v-if="fallback && !imageLoaded"
			class="text-on-surface-variant h-full w-full"
			type="lightning-slash"
		/>
	</figure>
</template>

<script lang="ts" setup>
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
