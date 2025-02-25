<template>
	<div v-if="hub" class="relative flex h-36 w-full cursor-pointer flex-col justify-between gap-1 overflow-hidden rounded-md bg-ph-background-3 p-4 text-center hover:bg-blue dark:bg-ph-background-5">
		<H3 class="m-0">
			<TruncatedText>{{ hub.hubName }}</TruncatedText>
		</H3>
		<HubIcon :icon-url="hub.iconUrlLight" :icon-url-dark="hub.iconUrlDark" :hub-name="hub.name" class="mx-auto max-h-16 max-w-16"></HubIcon>
		<TruncatedText>{{ description }}</TruncatedText>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { Hub } from '@/model/Hubs';
	import HubIcon from '../../../../hub-client/src/components/ui/HubIcon.vue';

	const props = defineProps<{ hub: Hub }>();

	const description = computed(() => {
		if (props.hub.description !== '') {
			return props.hub.description;
		}
		return props.hub.hubId;
	});
</script>
