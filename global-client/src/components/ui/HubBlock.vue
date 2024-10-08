<template>
	<div v-if="hub" class="bg-ph-background-3 dark:bg-ph-background-5 hover:bg-blue p-4 rounded-md relative text-center overflow-hidden cursor-pointer">
		<H3>{{ hub.hubId }}</H3>
		<HubLogo :hub-id="hub.hubId" :hub-url="hub.url" :change-to-dark="true" class="h-16 w-16 mx-auto"></HubLogo>
		<TruncatedText>{{ description }}</TruncatedText>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { Hub } from '@/store/store';

	const props = defineProps<{ hub: Hub }>();

	const description = computed(() => {
		if (props.hub.description !== '') {
			return props.hub.description;
		}
		return props.hub.hubId;
	});
</script>
