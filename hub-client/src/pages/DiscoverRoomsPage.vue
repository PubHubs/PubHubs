<template>
	<div class="flex flex-col overflow-hidden">
		<div class="relative h-36">
			<ImagePlaceholder class="absolute top-0 left-0 opacity-50"></ImagePlaceholder>
			<div class="grid gap-2 absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/3 w-3/4">
				<span class="flex gap-2 items-center mx-auto md:m-0 w-fit">
					<Icon type="compass" size="sm"></Icon>
					<H1 class="theme-light:text-black">{{ $t('rooms.discover') }}</H1>
				</span>
				<SearchRoomsInput @update-search-term="updateSearchTerm" />
			</div>
		</div>
		<div class="flex-auto flex flex-col justify-center gap-16 bg-hub-background p-16 max-w-screen-lg mx-auto">
			<!-- TODO: Finer filtering and featuring rooms -->

			<div v-if="filteredRooms.length > 0" class="grid lg:grid-cols-2 w-full gap-5 gap-x-16 justify-center">
				<RoomPill v-for="room in filteredRooms" :key="room.room_id" :room="room" :roomIsSecure="rooms.roomIsSecure(room.room_id)"></RoomPill>
			</div>
			<H2 v-else-if="roomFilter.length > 0" class="mx-auto">{{ t('rooms.no_match') }}</H2>
			<H2 v-else class="mx-auto">{{ t('rooms.unavailable') }}</H2>
		</div>
	</div>
</template>

<script setup lang="ts">
	import ImagePlaceholder from '@/components/elements/ImagePlaceholder.vue';
	import SearchRoomsInput from '@/components/forms/SearchRoomsInput.vue';
	import { useRooms } from '@/store/store';
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	const rooms = useRooms();
	const roomFilter = ref('');
	const { t } = useI18n();

	const filteredRooms = computed(() => {
		let visibleRooms = rooms.visiblePublicRooms;

		if (roomFilter.value.length > 1) {
			return visibleRooms.filter((room) => room.name?.toLocaleLowerCase().includes(roomFilter.value) || room.topic?.toLocaleLowerCase().includes(roomFilter.value));
		}
		return visibleRooms;
	});

	function updateSearchTerm(searchTerm: string) {
		roomFilter.value = searchTerm.trim().toLowerCase();
	}
</script>
