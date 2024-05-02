<template>
	<div class="m-2 cursor-pointer">
		<div v-if="hub" class="bg-ph-background-3 dark:bg-ph-background-5 hover:bg-blue p-4 rounded-md relative text-center overflow-hidden">
			<H3>{{ hub.hubId }}</H3>
			<HubLogo :hub-id="hub.hubId" :hub-url="hub.url" :change-to-dark="true" class="h-16 w-16 mx-auto"></HubLogo>
			<TruncatedText>{{ hub.description }}</TruncatedText>
		</div>
	</div>
</template>

<script setup lang="ts">
	import { Hub } from '@/store/store';

	import HubLogo from './HubLogo.vue';

	const props = defineProps<{ hub: Hub }>();
</script>
