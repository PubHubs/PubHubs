<template>
	<figure :class="props.class" class="w-full h-[80px]">
		<img v-if="props.bannerUrl" :src="props.bannerUrl" onerror="this.style.display = 'none'" class="h-full w-full object-cover" />
		<img v-else :src="defaultUrl" onerror="this.style.display = 'none'" class="h-full w-full object-cover" />
	</figure>
</template>

<script setup lang="ts">
	// Packages
	import defaultUrl from '/public/img/banner.svg';

	// Stores
	import { useSettings } from '@hub-client/stores/settings';

	// Types
	type Props = {
		bannerUrl?: string;
		hubNameForImgAlt?: string;
		class?: string;
	};

	const props = defineProps<Props>();

	const settings = useSettings();
</script>
