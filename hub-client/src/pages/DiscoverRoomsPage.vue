<template>
	<div class="h-[15svh] min-h-[150px] w-full">
		<ImagePlaceholder source="/img/imageplaceholder.jpg" />
	</div>
	<div class="mx-auto mb-8 flex w-full flex-col gap-16 md:w-4/6">
		<div class="-mt-[5.5rem] flex flex-col gap-2 px-8 md:px-0">
			<div class="flex items-center whitespace-nowrap ~gap-1/4">
				<div class="flex items-center gap-2">
					<Icon class="text-surface dark:text-on-surface" type="pubhubs-home" size="md" />
					<div class="font-body font-bold ~text-h3-min/h3-max">{{ $t('menu.discover') }}</div>
				</div>
			</div>
			<div class="relative">
				<input
					type="text"
					v-model="searchQuery"
					:placeholder="$t('others.search')"
					class="focus mb-4 w-full rounded border bg-surface px-4 py-2 text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:placeholder-on-surface-variant focus:ring-accent-primary"
				/>
				<Icon type="search" class="pointer-events-none absolute right-2 top-[20%] z-10 text-on-surface-variant" size="sm" />
			</div>
		</div>
		<div class="flex flex-col gap-2">
			<div class="rounded-xl bg-surface-low px-8 py-8 md:px-12">
				<div v-if="filteredRooms.length > 0" class="grid w-full grid-cols-1 justify-center gap-5 gap-x-16 lg:grid-cols-2">
					<RoomPill
						v-for="room in filteredRooms"
						:key="room.room_id"
						:room="room"
						:roomIsSecure="rooms.roomIsSecure(room.room_id)"
						:memberOfRoom="rooms.memberOfPublicRoom(room.room_id)"
						:securedRoomLoginFlow="currentRoomId === room.room_id"
						@toggle-secured-room="setCurrentRoomId(room.room_id)"
					/>
				</div>
				<div v-else class="flex w-full items-center justify-center">
					<P>{{ t('others.search_hubs_not_found') }}</P>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Components
	import ImagePlaceholder from '@/components/elements/ImagePlaceholder.vue';
	import RoomPill from '@/components/rooms/RoomPill.vue';
	import Icon from '@/components/elements/Icon.vue';

	import { useRooms } from '@/logic/store/store';
	import { computed, ref, onMounted } from 'vue';
	import { useI18n } from 'vue-i18n';

	const currentRoomId = ref<string | null>(null);
	const searchQuery = ref('');

	const rooms = useRooms();
	const { t } = useI18n();

	const filteredRooms = computed(() => {
		let visibleRooms = rooms.visiblePublicRooms;

		return visibleRooms.filter((room) => room.name?.toLowerCase().includes(searchQuery.value.toLowerCase()) || room.topic?.toLowerCase().includes(searchQuery.value.toLowerCase()));
	});

	onMounted(async () => {
		rooms.fetchPublicRooms();
	});

	function setCurrentRoomId(roomId: string) {
		currentRoomId.value = roomId;
	}
</script>
