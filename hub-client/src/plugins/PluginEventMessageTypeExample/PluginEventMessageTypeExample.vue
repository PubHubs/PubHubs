<template>
	<div class="bg-black text-white mb-2">
		<H3>Plugin message type = '{{ event.plugin.type }}'</H3>
		<Json :json="event"></Json>
	</div>
</template>

<script setup lang="ts">
	defineProps<{ event: any }>();
</script>
