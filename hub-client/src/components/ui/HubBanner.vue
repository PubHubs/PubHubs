<template>
	<figure :class="['h-[10svh] min-h-[90px] w-full', props.class]">
		<img v-if="props.bannerUrl" :src="props.bannerUrl" onerror="this.style.display='none'" class="h-full w-full object-cover" />
		<img v-else :src="defaultUrl" onerror="this.style.display='none'" class="h-full w-full object-cover" />
	</figure>
</template>

<script setup lang="ts">
	type Props = {
		bannerUrl?: string;
		hubNameForImgAlt?: string;
		class?: string;
	};
	const props = defineProps<Props>();
	const defaultUrl = 'client/img/banner.svg';
</script>
