<template>
	<img v-if="authMediaUrl" :alt="message.body" :src="authMediaUrl" class="w-[20rem] max-h-[25rem] object-contain cursor-pointer" @click.stop="showFullImage = true" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="w-[100vw] h-[100vh] top-0 left-0 fixed z-50 flex" :show-closing-cross="true">
		<img :alt="message.body" :src="authMediaUrl" class="h-4/5 w-4/5 m-auto object-contain" />
	</Popover>
</template>

<script setup lang="ts">
	// Components
	import Popover from '../ui/Popover.vue';

	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { TImageMessageEventContent } from '@/model/events/TMessageEvent';
	import { ref, onMounted } from 'vue';
	import { FeatureFlag, useSettings } from '@/store/settings';

	const matrixFiles = useMatrixFiles();
	const settings = useSettings();
	const showFullImage = ref(false);
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TImageMessageEventContent }>();

	onMounted(async () => {
		authMediaUrl.value = await matrixFiles.useAuthorizedMediaUrl(props.message.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia));
	});
</script>
