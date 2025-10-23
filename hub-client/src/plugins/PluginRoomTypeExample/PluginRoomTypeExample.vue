<template>
	<HeaderFooter v-if="rooms.currentRoomExists" class="pl-3">
		<template #header>
			<H1 class="text-blue m-0 font-bold">{{ rooms.currentRoom?.name }}</H1>
			<p class="leading-4 ~text-label-min/label-max">Example of room Type plugin. [ Type: {{ rooms.currentRoom?.getType() }}]</p>
		</template>

		<Json :json="rooms.currentRoom?.getLiveTimelineEvents()"></Json>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import H1 from '@hub-client/components/elements/H1.vue';
	import Json from '@hub-client/components/elements/Json.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';

	const rooms = useRooms();
</script>
