<template>
	<div>
		<div class="flex items-center gap-2 overflow-x-hidden rounded-md">
			<Icon type="file" />
			<a
				class="text-blue truncate"
				:href="fileURL"
				target="_blank"
				download
				>{{ fileName }}</a
			>
			<Button
				icon="x"
				variant="errorIcon"
				size="sm"
				title="Remove file"
				@click.stop="$emit('remove')"
			></Button>
		</div>
	</div>
</template>
<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { type TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	import Button from '@hub-client/new-design/components/Button.vue';

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
			authMediaUrl.value = fileEvent.url
				? await matrixFiles.useAuthorizedMediaUrl(fileEvent.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia))
				: undefined;
		}
	});
</script>
