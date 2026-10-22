<template>
	<figure class="rounded-base flex aspect-square h-full w-auto items-center justify-center overflow-hidden">
		<img
			v-show="imageLoaded"
			:alt="`Icon of Hub ${hubNameForImgAlt ?? ''}`"
			class="bg-surface-base dark:bg-on-surface h-full w-full object-cover"
			:src="src"
			@load="imageLoaded = true"
		/>
		<Icon
			v-if="fallback && !imageLoaded"
			class="text-on-surface-dim h-full w-full"
			type="lightning-slash"
		/>
	</figure>
</template>

<script lang="ts" setup>
	// Packages
	import { onMounted, ref } from 'vue';

	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useImageObjectUrl } from '@hub-client/composables/useImageObjectUrl';

	// Types
	type Props = {
		hubNameForImgAlt?: string; // Used when showing multiple Hubs.
		iconUrl: string;
		iconUrlDark: string;
		isActive?: boolean;
	};

	const props = defineProps<Props>();

	// Fetched instead of bound straight to `<img src>`: the icon lives on the hub's plain-HTTP dev
	// address, which the native shell's https origin would auto-upgrade. See the composable.
	// Cached, so the icon also shows while the hub can't be reached.
	const { src } = useImageObjectUrl(() => props.iconUrl, { cache: true });

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
</script>
