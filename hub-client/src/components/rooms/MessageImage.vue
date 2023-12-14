<template>
	<img :alt="message.body" :src="formUrlfromMxc(message.url)" class="max-w-full h-auto" />
</template>

<script setup lang="ts">
	import { useMatrixFiles } from '@/composables/useMatrixFiles';
	import { usePubHubs } from '@/core/pubhubsStore';
	import { M_ImageMessageEventContent } from '@/types/events';
	const pubhubs = usePubHubs();
	const { formUrlfromMxc } = useMatrixFiles(pubhubs);

	const props = defineProps<{ message: M_ImageMessageEventContent }>();
</script>
