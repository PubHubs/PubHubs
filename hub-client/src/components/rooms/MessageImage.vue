<template>
	<img v-if="authMediaUrl" :alt="message.body" :src="authMediaUrl" class="max-h-[25rem] w-[20rem] cursor-pointer rounded-md object-contain" @click.stop="showFullImage = true" />
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed left-0 top-0 z-50 flex h-screen w-screen" :show-closing-cross="true">
		<img :alt="message.body" :src="authMediaUrl" class="m-auto h-4/5 w-4/5 object-contain" />
	</Popover>
	<template v-if="message.body !== message.filename">
		<p v-html="message.body" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
	</template>
</template>

<script setup lang="ts">
	// Components
	import Popover from '../ui/Popover.vue';

	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { TImageMessageEventContent } from '@/model/events/TMessageEvent';
	import { ref, onMounted } from 'vue';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';

	const matrixFiles = useMatrixFiles();
	const settings = useSettings();
	const showFullImage = ref(false);
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TImageMessageEventContent }>();

	onMounted(async () => {
		authMediaUrl.value = await matrixFiles.useAuthorizedMediaUrl(props.message.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia));
	});
</script>
