<template>
	<img v-if="img" v-show="loaded" :alt="img" :src="image" class="h-full cursor-pointer rounded-md object-contain" @click.stop="showFullImage = true" @load="imgLoaded()" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed left-0 top-0 z-50 flex h-screen w-screen" :show-closing-cross="true">
		<img :alt="img" :src="image" class="m-auto h-4/5 w-4/5 object-contain" />
	</Popover>
</template>

<script setup lang="ts">
	import Popover from '../ui/Popover.vue';

	import { ref, onMounted, watch } from 'vue';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';

	const { isMxcUrl, useAuthorizedMediaUrl } = useMatrixFiles();

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
		let url = props.img as string;
		if (props.img) {
			if (isMxcUrl(props.img)) {
				url = await useAuthorizedMediaUrl(props.img, true);
			}
		}
		image.value = url;
	}

	function imgLoaded() {
		loaded.value = true;
	}
</script>
