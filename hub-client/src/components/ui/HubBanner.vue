<template>
	<figure
		class="h-full w-full"
		:class="props.class"
	>
		<!-- Without a hub name the banner carries no information of its own, so it is decorative -->
		<img
			v-if="src"
			class="h-full w-full object-cover"
			onerror="this.style.display = 'none'"
			:src="src"
			:alt="props.hubNameForImgAlt ?? ''"
		/>
		<!-- Only when there is no banner to load at all, so a slow fetch doesn't flash the default first -->
		<img
			v-else-if="!props.bannerUrl"
			class="h-full w-full object-cover"
			onerror="this.style.display = 'none'"
			:src="defaultUrl"
			:alt="props.hubNameForImgAlt ?? ''"
		/>
	</figure>
</template>

<script lang="ts" setup>
	// Assets
	import defaultUrl from '@hub-client/assets/banner.svg';

	// Composables
	import { useImageObjectUrl } from '@hub-client/composables/useImageObjectUrl';

	// Types
	type Props = {
		bannerUrl?: string;
		hubNameForImgAlt?: string;
		class?: string;
	};

	const props = defineProps<Props>();

	// Fetched instead of bound straight to `<img src>`: the banner lives on the hub's plain-HTTP dev
	// address, which the native shell's https origin would auto-upgrade. See the composable.
	// Cached, so the banner also shows while the hub can't be reached.
	const { src } = useImageObjectUrl(() => props.bannerUrl, { cache: true });
</script>
