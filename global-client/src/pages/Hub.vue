<template>
	<iframe v-if="hubs.currentHubExists" :src="hubUrl" class="w-full h-full mo-red" name="hub" :id="iframeHubId"></iframe>
</template>

<script setup lang="ts">
	import { onMounted, watch, computed } from 'vue';
	import { useRoute } from 'vue-router';
	import { iframeHubId, useHubs, useGlobal } from '@/store/store';

	const route = useRoute();
	const hubs = useHubs();
	const global = useGlobal();

	onMounted(() => {
		hubs.changeHub(route.params);
	});

	watch(route, () => {
		hubs.changeHub(route.params);
	});

	const hubUrl = computed(() => {
		if (!global.loggedIn) {
			return hubs.currentHub.url + '#/hub/';
		}
		return hubs.currentHub.url;
	});
</script>
