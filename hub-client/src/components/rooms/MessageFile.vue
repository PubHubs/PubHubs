<template>
	<div v-if="url" class="mt-2 rounded-md bg-hub-background-3 p-2 flex">
		<Icon type="paperclip" class="mr-2"></Icon>
		<a class="text-blue" target="_blank" :href="url">{{ message.filename }}</a>
	</div>
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { SMI } from '@/dev/StatusMessage';
	import { LOGGER } from '@/foundation/Logger';
	import { TFileMessageEventContent } from '@/model/events/TMessageEvent';

	const { formUrlfromMxc } = useMatrixFiles();

	const logger = LOGGER;

	const props = defineProps<{ message: TFileMessageEventContent }>();

	const url = getUrl();
	if (!url) {
		logger.error(SMI.ROOM_TIMELINEWINDOW, 'Url is missing in file message', props.message);
	}

	function getUrl() {
		if (!props.message.url) return undefined;
		return formUrlfromMxc(props.message.url);
	}
</script>
