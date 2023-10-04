<template>
	<img :alt="message.body" :src="pubhubs.getBaseUrl + '/_matrix/media/r0/download/' + message.url.slice(6)" class="max-w-full h-auto" />
</template>

<script setup lang="ts">
	import { usePubHubs } from '@/core/pubhubsStore';
import { M_ImageMessageEventContent } from '@/types/events';
	const pubhubs = usePubHubs();

	const props = defineProps<{message: M_ImageMessageEventContent}>();
</script>
