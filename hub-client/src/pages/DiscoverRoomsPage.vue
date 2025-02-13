<template>
	<HeaderFooter>
		<template #header>
			<ImagePlaceholder class="absolute left-0 top-0 opacity-50"></ImagePlaceholder>
			<div class="absolute bottom-0 left-1/2 grid w-3/4 -translate-x-1/2 translate-y-1/3 gap-2">
				<span class="mx-auto flex w-fit items-center gap-2 md:m-0">
					<Icon type="compass" size="sm"></Icon>
					<H1 class="theme-light:text-black">{{ $t('rooms.discover') }}</H1>
				</span>
				<SearchRoomsInput @update-search-term="updateSearchTerm" />
			</div>
		</template>

		<div class="mx-auto flex max-w-screen-lg flex-auto flex-col justify-center gap-16 bg-hub-background p-16">
			<!-- TODO: Finer filtering and featuring rooms -->

			<div v-if="filteredRooms.length > 0" class="grid w-full justify-center gap-5 gap-x-16 lg:grid-cols-2">
				<RoomPill
					v-for="room in filteredRooms"
					:key="room.room_id"
					:room="room"
					:roomIsSecure="rooms.roomIsSecure(room.room_id)"
					:memberOfRoom="rooms.memberOfPublicRoom(room.room_id)"
					:securedRoomLoginFlow="currentRoomId === room.room_id"
					@toggle-secured-room="setCurrentRoomId(room.room_id)"
				></RoomPill>
			</div>
			<H2 v-else-if="roomFilter.length > 0" class="mx-auto">{{ t('rooms.no_match') }}</H2>
			<H2 v-else class="mx-auto">{{ t('rooms.unavailable') }}</H2>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Components
	import ImagePlaceholder from '@/components/elements/ImagePlaceholder.vue';
	import SearchRoomsInput from '@/components/forms/SearchRoomsInput.vue';
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import RoomPill from '@/components/rooms/RoomPill.vue';
	import H2 from '@/components/elements/H2.vue';
	import Icon from '@/components/elements/Icon.vue';
	import H1 from '@/components/elements/H1.vue';

	import { useRooms } from '@/store/store';
	import { computed, ref, onMounted } from 'vue';
	import { useI18n } from 'vue-i18n';

	const currentRoomId = ref<string | null>(null);

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

	onMounted(async () => {
		rooms.fetchPublicRooms();
	});

	function updateSearchTerm(searchTerm: string) {
		roomFilter.value = searchTerm.trim().toLowerCase();
	}

	function setCurrentRoomId(roomId: string) {
		currentRoomId.value = roomId;
	}
</script>
