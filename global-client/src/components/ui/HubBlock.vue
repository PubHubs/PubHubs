<template>
	<div v-if="hub" class="flex flex-col gap-1 text-center justify-between bg-ph-background-3 dark:bg-ph-background-5 hover:bg-blue h-36 p-4 rounded-md relative cursor-pointer w-full overflow-hidden">
		<H3 class="m-0"
			><TruncatedText>{{ hub.hubId }}</TruncatedText></H3
		>
		<HubIcon :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :hub-name="hub.name" class="max-h-16 max-w-16 mx-auto"></HubIcon>
		<TruncatedText>{{ description }}</TruncatedText>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { Hub } from '@/store/store';
	import HubIcon from '../../../../hub-client/src/components/shared-with-global-client/HubIcon.vue';

	const props = defineProps<{ hub: Hub }>();

	const description = computed(() => {
		if (props.hub.description !== '') {
			return props.hub.description;
		}
		return props.hub.hubId;
	});
</script>
