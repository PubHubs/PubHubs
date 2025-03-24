<template>
	<HeaderFooter v-if="rooms.currentRoomExists" class="pl-3">
		<template #header>
			<div class="flex">
				<div>
					<H1 class="text-blue m-0 font-bold">{{ rooms.currentRoom?.name }}</H1>
					<p class="leading-4 ~text-label-min/label-max">Example of room plugin by id. [ roomId: {{ rooms.currentRoom?.roomId }} ]</p>
				</div>
			</div>
		</template>

		<Json :json="rooms.currentRoom?.getLiveTimelineEvents()" />
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import H1 from '@/components/elements/H1.vue';
	import Json from '@/components/elements/Json.vue';

	import { useRooms } from '@/logic/store/store';
	const rooms = useRooms();
</script>
