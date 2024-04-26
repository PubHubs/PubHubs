<template>
	<p v-html="event.content.ph_body" class="text-ellipsis overflow-hidden"></p>
</template>

<script setup lang="ts">
	import { M_MessageEvent } from '@/types/events';
	defineProps<{ event: M_MessageEvent }>();
</script>
