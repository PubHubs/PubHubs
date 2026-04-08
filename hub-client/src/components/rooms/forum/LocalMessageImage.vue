<template>
	<div class="relative h-600">
		<img
			:src="imageUrl"
			class="h-600 cursor-pointer rounded-xl bg-cover bg-center object-contain"
			@click.stop="showFullImage = true"
		/>
		<div class="absolute -top-300 -right-300">
			<Button
				icon="x"
				variant="errorIcon"
				size="sm"
				title="Remove image"
				@click.stop="$emit('remove')"
			></Button>
		</div>
	</div>
	<Popover
		v-if="showFullImage"
		class="fixed top-0 left-0 z-50 flex h-screen w-screen"
		:show-closing-cross="true"
		@close="showFullImage = false"
	>
		<img
			:src="imageUrl"
			class="m-auto h-4/5 w-4/5 object-contain"
		/>
	</Popover>
</template>

<script setup lang="ts">
	import { computed, onMounted, ref } from 'vue';

	import Popover from '@hub-client/components/ui/Popover.vue';

	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';
	import { type TLocalAttachmentMessageEventContent } from '@hub-client/models/events/forum/TLocalEventContent';

	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	import Button from '@hub-client/new-design/components/Button.vue';

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
