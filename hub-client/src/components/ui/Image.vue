<template>
	<img v-if="img" v-show="loaded" :alt="img" :src="image" class="h-full cursor-pointer rounded-md object-contain" @click.stop="showFullImage = true" @load="imgLoaded()" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed top-0 left-0 z-50 flex h-screen w-screen" :show-closing-cross="true">
		<img :alt="img" :src="image" class="m-auto h-4/5 w-4/5 object-contain" />
	</Popover>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';

	// Components
	import Popover from '@hub-client/components/ui/Popover.vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	const { getAuthorizedMediaUrl } = useMatrixFiles();
	const props = defineProps<{ img: string }>();
	const image = ref(props.img);
	const showFullImage = ref(false);
	const loaded = ref(false);

	onMounted(async () => {
		await getImage();
	});

	watch(props, async () => {
		await getImage();
	});

	async function getImage() {
		image.value = await getAuthorizedMediaUrl(props.img);
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
