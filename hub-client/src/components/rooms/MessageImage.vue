<template>
	<img
		v-if="authMediaUrl"
		:alt="message.body"
		:src="authMediaUrl"
		class="max-h-[25rem] w-[20rem] cursor-pointer rounded-md object-contain"
		@click.stop="showFullImage = true"
		v-context-menu="
			(evt: any) =>
				openMenu(evt, [
					{ label: t('menu.copy_image'), icon: 'copy', onClick: () => imageActions.copyImage(authMediaUrl!) },
					{ label: t('menu.save_image'), icon: 'download-simple', onClick: () => imageActions.saveImage(authMediaUrl!, message.filename ?? message.body ?? 'image') },
				])
		"
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
			<img :alt="message.body" :src="authMediaUrl" class="max-h-[90vh] max-w-[90vw] object-contain" />
			<button class="absolute top-4 right-4 cursor-pointer text-white hover:text-gray-300" @click="showFullImage = false" :title="t('dialog.close')">
				<Icon type="x" size="lg" />
			</button>
		</div>
	</Teleport>
	<template v-if="message.body !== message.filename">
		<p v-html="message.body" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
	</template>
</template>

<script setup lang="ts">
	// Packages
	import { nextTick, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';

	// Composables
	import { useImageActions } from '@hub-client/composables/useImageActions';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Models
	import { TImageMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { useDialog } from '@hub-client/stores/dialog';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const matrixFiles = useMatrixFiles();
	const imageActions = useImageActions();
	const dialog = useDialog();
	const showFullImage = ref(false);
	const lightboxRef = ref<HTMLElement | null>(null);
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TImageMessageEventContent; deleted?: boolean }>();

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
		authMediaUrl.value = await matrixFiles.getAuthorizedMediaUrl(props.message.url);
	});
</script>
