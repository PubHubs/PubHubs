<template>
	<div
		v-if="authMediaUrl?.url"
		class="bg-surface mt-2 flex items-center gap-2 overflow-x-hidden rounded-md p-2"
		v-context-menu="(evt: any) => openMenu(evt, [{ label: t('menu.download_file'), icon: 'download-simple', onClick: () => downloadFile() }])"
	>
		<Icon type="file" size="md" />
		<a class="text-blue truncate" target="_blank" :href="authMediaUrl.url">{{ message.filename }}</a>
	</div>
	<p v-if="message.body !== message.filename" v-html="message.body" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
</template>

<script setup lang="ts">
	// Packages
	import { onBeforeUnmount, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Models
	import { TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<BlobManager>();

	const props = defineProps<{ message: TFileMessageEventContent; deleted?: boolean }>();

	onMounted(async () => {
		const url = props.message.url ? await matrixFiles.getAuthorizedMediaUrl(props.message.url) : undefined;
		authMediaUrl.value?.revoke();
		authMediaUrl.value = new BlobManager(url);
	});

	onBeforeUnmount(() => {
		authMediaUrl.value?.revoke();
	});

	function downloadFile() {
		if (!authMediaUrl.value?.url) return;
		const a = document.createElement('a');
		a.href = authMediaUrl.value.url;
		a.download = props.message.filename ?? props.message.body ?? 'file';
		a.click();
	}
</script>
