<template>
	<figure :class="[isMobile ? 'h-[7.5rem]' : 'flex h-[10rem]', props.class]" class="w-full">
		<img v-if="props.bannerUrl" :src="props.bannerUrl" onerror="this.style.display='none'" class="h-full w-full object-cover" />
		<img v-else :src="defaultUrl" onerror="this.style.display='none'" class="h-full w-full object-cover" />
	</figure>
</template>

<script setup lang="ts">
	// Packages
	import { computed } from 'vue';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Types
	type Props = {
		bannerUrl?: string;
		hubNameForImgAlt?: string;
		class?: string;
	};

	const props = defineProps<Props>();
	const defaultUrl = 'public/img/banner.svg';

	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
</script>
