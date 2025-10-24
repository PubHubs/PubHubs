<template>
	<a v-if="download" target="_blank" :href="download" :download="filename" class="xs:~text-label-small-min/label-small-max">{{ filename }}</a>
	<span v-else class="xs:~text-label-small-min/label-small-max">{{ filename }}</span>
</template>

<script setup lang="ts">
	// Packages
	import { onMounted, ref, watch } from 'vue';

	// Composables
	import { fileDownload } from '@hub-client/composables/fileDownload';
	import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';

	const { formUrlfromMxc } = useMatrixFiles();
	const pubhubs = usePubhubsStore();
	const accessToken = pubhubs.Auth.getAccessToken();
	const props = defineProps<{ url: string; filename: string }>();
	const download = ref(props.url);

	onMounted(async () => {
		await getUrl();
	});

	watch(props, async () => {
		await getUrl();
	});

	async function getUrl() {
		const url = formUrlfromMxc(props.url, true);
		download.value = (await fileDownload(accessToken, url)) || '';
		if (!download.value) {
			console.error('Failed to load the file');
		}
	}
</script>
