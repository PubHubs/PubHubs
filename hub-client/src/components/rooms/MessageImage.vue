<template>
	<img
		v-if="authMediaUrl?.url"
		v-context-menu="
			(evt: any) =>
				openMenu(evt, [
					{ label: t('menu.copy_image'), icon: 'copy', onClick: () => authMediaUrl?.url && imageActions.copyImage(authMediaUrl.url) },
					{
						label: t('menu.save_image'),
						icon: 'download-simple',
						onClick: () => authMediaUrl?.url && imageActions.saveImage(authMediaUrl.url, message.filename ?? message.body ?? 'image'),
					},
				])
		"
		:alt="message.body"
		:src="authMediaUrl.url"
		class="rounded-base border-surface-elevated max-h-[25rem] w-xs cursor-pointer border-3 object-contain"
		@click.stop="showFullImage = true"
		@touchstart.stop
	/>
	<Teleport to="body">
		<div
			v-if="showFullImage"
			ref="lightboxRef"
			tabindex="-1"
			class="bg-scrim/50 dark:bg-scrim/75 fixed inset-0 z-50 flex items-center justify-center outline-none"
			@click.self="showFullImage = false"
			@contextmenu.prevent
			@keydown.escape="showFullImage = false"
		>
			<img
				:alt="message.body"
				:src="authMediaUrl?.url"
				class="max-h-[90vh] max-w-[90vw] object-contain"
			/>
			<button
				class="absolute top-200 right-200 cursor-pointer text-white hover:text-gray-300"
				:title="t('dialog.close')"
				@click="showFullImage = false"
			>
				<Icon type="x" />
			</button>
		</div>
	</Teleport>
	<!-- Message body with mention support -->
	<MessageBodyWithMentions
		v-if="message.body !== message.filename"
		:body="message.body"
		:ph-body="message.ph_body"
	/>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useImageActions } from '@hub-client/composables/useImageActions';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';

	const props = defineProps<{ message: TImageMessageEventContent }>();

	const logger = createLogger('MessageImage');

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const matrixFiles = useMatrixFiles();
	const imageActions = useImageActions();
	const dialog = useDialog();
	const showFullImage = ref(false);
	const lightboxRef = ref<HTMLElement | null>(null);
	const authMediaUrl = ref<BlobManager>();

	watch(showFullImage, async (show) => {
		if (show) {
			dialog.showModal();
			await nextTick();
			lightboxRef.value?.focus();
		} else {
			dialog.hideModal();
		}
	});

	onMounted(async () => {
		try {
			const url = await matrixFiles.getAuthorizedMediaUrl(props.message.url);
			authMediaUrl.value = new BlobManager(url);
		} catch (error) {
			logger.error('Failed to load authorized media', { url: props.message.url, error });
		}
	});

	onBeforeUnmount(() => {
		authMediaUrl.value?.revoke();
	});
</script>
