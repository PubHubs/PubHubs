<template>
	<img v-if="authMediaUrl" :alt="message.body" :src="authMediaUrl" class="max-h-[25rem] w-[20rem] cursor-pointer rounded-md object-contain" @click.stop="showFullImage = true" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed top-0 left-0 z-50 flex h-screen w-screen" :show-closing-cross="true">
		<img :alt="message.body" :src="authMediaUrl" class="m-auto h-4/5 w-4/5 object-contain" />
	</Popover>
	<template v-if="message.body !== message.filename">
		<p v-html="message.body" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
	</template>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref } from 'vue';

	// Components
	import Popover from '@hub-client/components/ui/Popover.vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Models
	import { TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	const matrixFiles = useMatrixFiles();
	const showFullImage = ref(false);
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TImageMessageEventContent }>();

	onMounted(async () => {
		authMediaUrl.value = await matrixFiles.getAuthorizedMediaUrl(props.message.url);
	});
</script>
