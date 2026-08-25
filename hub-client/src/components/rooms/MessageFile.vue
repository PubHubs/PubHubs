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
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import MessageBodyWithMentions from '@hub-client/components/rooms/MessageBodyWithMentions.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useAuthMediaUrl } from '@hub-client/composables/useAuthMediaUrl';
	import { saveAs } from '@hub-client/composables/useFileDownload';

	// Logic
	import { requestFileShare, shouldDelegateToGlobalClient } from '@hub-client/logic/core/requestFileShare';
	import { createLogger } from '@hub-client/logic/logging/Logger';

	// Models
	import { type TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Props
	const props = defineProps<{ message: TFileMessageEventContent }>();

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const logger = createLogger('MessageFile');

	const { authMediaUrl } = useAuthMediaUrl(() => props.message.url);

	function filename() {
		return props.message.filename ?? props.message.body ?? 'file';
	}

	// In the native app this client is an iframe, where both an <a download> and a
	// window.open are silently dropped. See requestFileShare for why, and why the
	// global client has to take over.
	async function delegateToGlobalClient() {
		const url = authMediaUrl.value?.url;
		if (!url) return;

		try {
			await requestFileShare(url, filename());
		} catch (error) {
			logger.error('Could not pass the file to the global client.', { error });
		}
	}

	function downloadFile() {
		if (!authMediaUrl.value?.url) return;
		if (shouldDelegateToGlobalClient()) {
			delegateToGlobalClient();
			return;
		}

		saveAs(authMediaUrl.value.url, filename());
	}

	function openFileUrl() {
		if (!authMediaUrl.value?.url) return;
		if (shouldDelegateToGlobalClient()) {
			delegateToGlobalClient();
			return;
		}

		window.open(authMediaUrl.value.url, '_blank');
	}
</script>
