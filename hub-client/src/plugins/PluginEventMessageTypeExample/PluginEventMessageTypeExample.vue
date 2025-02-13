<template>
	<div class="mb-2 bg-black text-white">
		<H3>Plugin message type = '{{ event.plugin?.type }}'</H3>
		<Json :json="event"></Json>
	</div>
</template>

<script setup lang="ts">
	// Components
	import H3 from '@/components/elements/H3.vue';
	import Json from '@/components/elements/Json.vue';

	import { TEvent } from '@/store/rooms';
	defineProps<{ event: TEvent }>();
</script>
