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
		class="max-h-[25rem] w-xs cursor-pointer rounded-md object-contain"
		@click.stop="showFullImage = true"
	/>
	<Teleport to="body">
		<div
			v-if="showFullImage"
			ref="lightboxRef"
			tabindex="-1"
			class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 outline-none"
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
				class="absolute top-4 right-4 cursor-pointer text-white hover:text-gray-300"
				:title="t('dialog.close')"
				@click="showFullImage = false"
			>
				<Icon
					type="x"
					size="lg"
				/>
			</button>
		</div>
	</Teleport>
	<!-- eslint-disable vue/no-v-html -- sanitized message body -->
	<p
		v-if="message.body !== message.filename"
		:class="{ 'text-on-surface-dim': deleted }"
		class="overflow-hidden text-ellipsis"
		v-html="message.body"
	></p>
	<!-- eslint-enable vue/no-v-html -->
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useImageActions } from '@hub-client/composables/useImageActions';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Models
	import { type TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const props = defineProps<{ message: TImageMessageEventContent; deleted?: boolean }>();
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
		const url = await matrixFiles.getAuthorizedMediaUrl(props.message.url);
		authMediaUrl.value?.revoke();
		authMediaUrl.value = new BlobManager(url);
	});

	onBeforeUnmount(() => {
		authMediaUrl.value?.revoke();
	});
</script>
