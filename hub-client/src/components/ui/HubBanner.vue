<template>
	<figure :class="props.class" class="h-[80px] w-full">
		<img v-if="props.bannerUrl" :src="props.bannerUrl" onerror="this.style.display = 'none'" class="h-full w-full object-cover" />
		<img v-else :src="defaultUrl" onerror="this.style.display = 'none'" class="h-full w-full object-cover" />
	</figure>
</template>

<script setup lang="ts">
	// Assets
	import defaultUrl from '@hub-client/assets/banner.svg';

	// Types
	type Props = {
		bannerUrl?: string;
		hubNameForImgAlt?: string;
		class?: string;
	};

	const props = defineProps<Props>();
</script>
