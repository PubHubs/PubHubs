<template>
	<div v-if="authMediaUrl" class="bg-surface mt-2 flex items-center gap-2 overflow-x-hidden rounded-md p-2">
		<Icon type="file" size="md" />
		<a class="text-blue truncate" target="_blank" :href="authMediaUrl">{{ message.filename }}</a>
	</div>
	<p v-if="message.body !== message.filename" v-html="message.body" :class="{ 'text-on-surface-dim': deleted }" class="overflow-hidden text-ellipsis"></p>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref } from 'vue';

	// Composables
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Models
	import { TFileMessageEventContent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

	const settings = useSettings();
	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TFileMessageEventContent }>();

	onMounted(async () => (authMediaUrl.value = props.message.url ? await matrixFiles.useAuthorizedMediaUrl(props.message.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) : undefined));
</script>
