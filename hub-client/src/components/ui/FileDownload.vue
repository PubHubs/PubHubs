<template>
	<a v-if="download" target="_blank" :href="download" :download="filename" class="xs:~text-label-small-min/label-small-max">{{ filename }}</a>
	<span v-else class="xs:~text-label-small-min/label-small-max">{{ filename }}</span>
</template>

<script setup lang="ts">
	import { ref, onMounted, watch } from 'vue';
	import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';
	import { fileDownload } from '@/logic/composables/fileDownload';
	import { usePubHubs } from '@/logic/core/pubhubsStore';

	const { formUrlfromMxc } = useMatrixFiles();
	const pubhubs = usePubHubs();
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
