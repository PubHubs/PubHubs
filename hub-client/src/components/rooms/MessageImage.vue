<template>
	<img v-if="authMediaUrl" :alt="message.body" :src="authMediaUrl" class="max-h-[25rem] w-[20rem] cursor-pointer object-contain" @click.stop="showFullImage = true" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed left-0 top-0 z-50 flex h-[100vh] w-[100vw]" :show-closing-cross="true">
		<img :alt="message.body" :src="authMediaUrl" class="m-auto h-4/5 w-4/5 object-contain" />
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
