<template>
	<div class="bg-black text-white mb-2">
		<H3>Plugin message type = '{{ event.plugin?.type }}'</H3>
		<Json :json="event"></Json>
	</div>
</template>

<script setup lang="ts">
	import { Event } from '@/store/rooms';
	defineProps<{ event: Event }>();
</script>
