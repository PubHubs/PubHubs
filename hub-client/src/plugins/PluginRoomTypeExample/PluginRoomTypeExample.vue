<template>
	<HeaderFooter v-if="rooms.currentRoomExists" class="pl-3">
		<template #header>
			<div class="flex">
				<div>
					<H1 class="m-0 text-blue font-bold">{{ rooms.currentRoom?.name }}</H1>
					<p class="text-sm leading-4">Example of room Type plugin. [ Type: {{ rooms.currentRoom?.getType() }}]</p>
				</div>
			</div>
		</template>

		<Json :json="rooms.currentRoom?.getLiveTimelineEvents()"></Json>
	</HeaderFooter>
</template>

<script setup lang="ts">
	import { useRooms } from '@/store/store';
	const rooms = useRooms();
</script>
