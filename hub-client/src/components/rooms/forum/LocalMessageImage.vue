<template>
	<div class="relative">
		<img :src="imageUrl" class="max-h-[5rem] max-w-[5rem] cursor-pointer rounded-2xl bg-cover bg-center object-contain" @click.stop="showFullImage = true" />
		<button @click.stop="$emit('remove')" class="bg-accent-red absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-white hover:bg-red-600" title="Remove image">
			<span class="text-xl font-bold">×</span>
		</button>
	</div>
	<Popover v-if="showFullImage" @close="showFullImage = false" class="fixed top-0 left-0 z-50 flex h-screen w-screen" :show-closing-cross="true">
		<img :src="imageUrl" class="m-auto h-4/5 w-4/5 object-contain" />
	</Popover>
</template>

<script setup lang="ts">
	import Popover from '@/components/ui/Popover.vue';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { TImageMessageEventContent } from '@/model/events/TMessageEvent';
	import { TLocalAttachmentMessageEventContent } from '@/plugins/PluginRoomTypeForum/TLocalEventContent';
	import { computed, onMounted, ref } from 'vue';

	const props = defineProps<{
		event: TLocalAttachmentMessageEventContent | TImageMessageEventContent;
	}>();

	defineEmits(['remove']);

	const showFullImage = ref(false);
	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<string | undefined>(undefined);
	const settings = useSettings();

	const isLocalAttachment = computed(() => 'blobURL' in props.event);
	const imageUrl = computed(() => {
		if (isLocalAttachment.value) {
			return (props.event as TLocalAttachmentMessageEventContent).blobURL;
		}
		return authMediaUrl.value;
	});

	onMounted(async () => {
		if (!isLocalAttachment.value) {
			const imageEvent = props.event as TImageMessageEventContent;
			authMediaUrl.value = await matrixFiles.useAuthorizedMediaUrl(imageEvent.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia));
		}
	});
</script>
