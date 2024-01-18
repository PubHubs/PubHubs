<template>
	<div class="bg-black text-white mb-2 opacity-50">
		<H3>Plugin event type = '{{ event.plugin.type }}'</H3>
		<Json :json="event"></Json>
	</div>
</template>

<script setup lang="ts">
	import { M_MessageEvent } from '@/types/events';

	defineProps<{ event: M_MessageEvent }>();
</script>
