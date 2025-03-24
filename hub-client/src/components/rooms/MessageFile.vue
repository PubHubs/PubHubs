<template>
	<div v-if="authMediaUrl" class="mt-2 flex overflow-x-hidden rounded-md p-2">
		<Icon type="paperclip" class="mr-2" />
		<a class="text-blue truncate" target="_blank" :href="authMediaUrl">{{ message.filename }}</a>
	</div>
</template>

<script setup lang="ts">
	import { TFileMessageEventContent } from '@/model/events/TMessageEvent';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { FeatureFlag, useSettings } from '@/logic/store/settings';
	import { onMounted, ref } from 'vue';

	const settings = useSettings();
	const matrixFiles = useMatrixFiles();
	const authMediaUrl = ref<string | undefined>(undefined);

	const props = defineProps<{ message: TFileMessageEventContent }>();

	onMounted(async () => (authMediaUrl.value = props.message.url ? await matrixFiles.useAuthorizedMediaUrl(props.message.url, settings.isFeatureEnabled(FeatureFlag.authenticatedMedia)) : undefined));
</script>
