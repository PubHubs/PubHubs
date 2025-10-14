<template>
	<!-- Banner -->
	<HubBanner :banner-url="hubSettings.bannerUrl" />

	<div class="mx-auto mb-8 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
		<!-- Search bar -->
		<div class="-mt-[5.5rem] flex flex-col gap-2">
			<div class="flex items-center whitespace-nowrap ~gap-1/4">
				<div class="flex items-center gap-2 py-2">
					<Icon class="text-surface dark:text-on-surface" type="compass" size="md" />
					<div role="heading" class="font-headings font-semibold ~text-h3-min/h3-max">{{ $t('menu.discover') }}</div>
				</div>
			</div>
			<div class="relative">
				<input
					type="text"
					v-model="searchQuery"
					:placeholder="$t('others.search_rooms')"
					class="focus mb-4 w-full rounded border bg-surface px-4 py-2 text-on-surface placeholder-on-surface-dim ~text-label-min/label-max focus:placeholder-on-surface-variant focus:ring-accent-primary"
				/>
				<Icon type="magnfying-glass" class="pointer-events-none absolute right-2 top-[20%] z-10 text-on-surface-variant" size="sm" />
			</div>
		</div>

		<!-- Room grid -->
		<div class="flex w-full flex-col gap-2">
			<div class="flex w-full justify-center rounded-xl py-8">
				<TransitionGroup v-if="filteredRooms.length > 0" name="room-grid" tag="div" class="grid w-full grid-cols-1 gap-8 px-0 transition-all duration-300 md:grid-cols-2 lg:px-16 2xl:grid-cols-3">
					<RoomCard
						v-for="room in filteredRooms"
						:key="room.room_id"
						:room="room"
						:isSecured="rooms.roomIsSecure(room.room_id)"
						:memberOfRoom="rooms.memberOfPublicRoom(room.room_id)"
						:timestamp="roomTimestamps[room.room_id] || 0"
						:isExpanded="expandedCardId === room.room_id"
						@toggleExpand="handleToggleExpand(room.room_id)"
					/>
				</TransitionGroup>

				<!-- No results message -->
				<div v-else class="flex w-full items-center justify-center">
					<P>{{ t('rooms.no_rooms_found') }}</P>
				</div>
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">
	// External imports
	import { computed, ref, onMounted, onBeforeMount, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import HubBanner from '@/components/ui/HubBanner.vue';
	import RoomCard from '@/components/rooms/RoomCard.vue';
	import Icon from '@/components/elements/Icon.vue';
	import P from '@/components/elements/P.vue';

	// Logic
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { useRooms } from '@/logic/store/store';

	// Setup
	const pubhubsStore = usePubHubs();
	const hubSettings = useHubSettings();
	const rooms = useRooms();
	const { t } = useI18n();
	const timestamps = ref<any[]>(rooms.roomtimestamps);
	const roomTimestamps = ref<Record<string, Date>>({});
	const expandedCardId = ref<string | null>(null);
	const searchQuery = ref('');

	const filteredRooms = computed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		return rooms.visiblePublicRooms.filter((room) => room.name?.toLowerCase().includes(query) || room.topic?.toLowerCase().includes(query));
	});

	const handleToggleExpand = (roomId: string) => {
		expandedCardId.value = expandedCardId.value === roomId ? null : roomId;
	};
	// Process timestamps into a map for easier lookup
	function processTimestamps() {
		if (!timestamps.value) return;

		const timestampMap: Record<string, Date> = {};
		timestamps.value.forEach((timestamp) => {
			if (timestamp && timestamp.length >= 2) {
				timestampMap[timestamp[1]] = new Date(timestamp[0]) || 0;
			}
		});
		roomTimestamps.value = timestampMap;
	}

	async function loadHubSettings() {
		const response = await pubhubsStore.fetchTimestamps();
		if (response) {
			timestamps.value = response;
			rooms.setTimestamps(response);
		}
	}

	// This ensures that whenever timestamps or rooms change, we reprocess the timestamps
	watchEffect(() => {
		if (timestamps.value && timestamps.value.length > 0) {
			processTimestamps();
		}
	});
	onBeforeMount(() => {
		loadHubSettings();
	});

	onMounted(async () => {
		await rooms.fetchPublicRooms();
	});
</script>
