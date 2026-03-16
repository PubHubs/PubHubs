<template>
	<div class="relative">
		<div class="flex overflow-x-hidden rounded-md">
			<Icon type="paperclip" class="mr-2" />
			<a class="text-blue truncate" :href="fileURL" target="_blank" download>{{ fileName }}</a>
		</div>
		<button @click.stop="$emit('remove')" class="bg-accent-red absolute -top-2 -right-6 flex h-5 w-5 items-center justify-center rounded-full text-white hover:bg-red-600" title="Remove file">
			<span class="text-xl font-bold">×</span>
		</button>
	</div>
</template>
<script setup lang="ts">
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { TFileMessageEventContent } from '@/model/events/TMessageEvent';
	import { TLocalAttachmentMessageEventContent } from '@/plugins/PluginRoomTypeForum/TLocalEventContent';
	import { computed, onMounted, ref } from 'vue';

	const props = defineProps<{
		event: TLocalAttachmentMessageEventContent | TFileMessageEventContent;
	}>();

	defineEmits(['remove']);

	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<string | undefined>(undefined);
	const settings = useSettings();

	const isLocalAttachment = computed(() => 'blobURL' in props.event);
	const fileURL = computed(() => {
		if (isLocalAttachment.value) {
			return (props.event as TLocalAttachmentMessageEventContent).blobURL;
		}
		return authMediaUrl.value;
	});
	const fileName = computed(() => {
		if (isLocalAttachment.value) {
			return (props.event as TLocalAttachmentMessageEventContent).file.name;
		}
		return (props.event as TFileMessageEventContent).filename;
	});

	onMounted(async () => {
		if (!isLocalAttachment.value) {
			const fileEvent = props.event as TFileMessageEventContent;
			authMediaUrl.value = fileEvent.url ? await matrixFiles.useAuthorizedMediaUrl(fileEvent.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) : undefined;
		}
	});
</script>
