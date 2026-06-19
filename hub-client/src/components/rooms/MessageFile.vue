<template>
	<div
		v-if="authMediaUrl?.url"
		v-context-menu="(evt: any) => openMenu(evt, [{ label: t('menu.download_file'), icon: 'download-simple', onClick: () => downloadFile() }])"
		class="bg-surface-base rounded-base border-surface-elevated flex w-fit items-center gap-100 overflow-x-hidden border-3 px-150 py-100"
	>
		<Icon
			class="text-on-surface"
			type="file"
			size="sm"
		/>
		<span
			class="hover:cursor-pointer"
			@click="openFileUrl()"
		>
			{{ message.filename }}
		</span>
	</div>
	<!-- Message body with mention support -->
	<MessageBodyWithMentions
		v-if="message.body !== message.filename"
		:body="message.body"
		:ph-body="message.ph_body"
	/>
</template>

<script setup lang="ts">
	// Packages
	import { onBeforeUnmount, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Logic
	import { BlobManager } from '@hub-client/logic/core/blobManager';

	// Models
	import { type TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{ message: TFileMessageEventContent }>();

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const matrixFiles = useMatrixFiles();

	const authMediaUrl = ref<BlobManager>();

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

	function openFileUrl() {
		if (!authMediaUrl.value?.url) return;
		window.open(authMediaUrl.value.url, '_blank');
	}
</script>
