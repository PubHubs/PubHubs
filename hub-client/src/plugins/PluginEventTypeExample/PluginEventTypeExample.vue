<template>
	<div class="mb-2 bg-black text-white opacity-50">
		<H3>Plugin event type = '{{ event.plugin?.type }}'</H3>
		<Json :json="event" />
	</div>
</template>

<script setup lang="ts">
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Json from '@hub-client/components/elements/Json.vue';

	// Stores
	import { TEvent } from '@hub-client/stores/rooms';

	defineProps<{ event: TEvent }>();
</script>
