<template>
	<figure
		class="h-full w-full"
		:class="props.class"
	>
		<img
			v-if="props.bannerUrl"
			class="h-full w-full object-cover"
			onerror="this.style.display = 'none'"
			:src="props.bannerUrl"
		/>
		<img
			v-else
			class="h-full w-full object-cover"
			onerror="this.style.display = 'none'"
			:src="defaultUrl"
		/>
	</figure>
</template>

<script lang="ts" setup>
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
