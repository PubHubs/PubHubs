<template>
	<div v-if="hub" class="flex flex-col gap-1 text-center justify-between bg-ph-background-3 dark:bg-ph-background-5 hover:bg-blue h-36 p-4 rounded-md relative cursor-pointer w-full overflow-hidden">
		<H3 class="m-0"
			><TruncatedText>{{ hub.hubId }}</TruncatedText></H3
		>
		<HubLogo :hub-id="hub.hubId" :hub-url="hub.url" :change-to-dark="true" class="max-h-16 max-w-16 mx-auto"></HubLogo>
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
