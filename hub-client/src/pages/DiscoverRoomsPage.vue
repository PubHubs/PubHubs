<template>
	<!-- Banner -->
	<HubBanner :banner-url="hubSettings.bannerUrl" />

	<div class="mx-auto mb-8 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
		<!-- Search bar -->
		<div class="-mt-[5.5rem] flex flex-col gap-2">
			<div class="flex items-center gap-2 whitespace-nowrap">
				<div class="flex items-center gap-2 py-2">
					<Icon class="text-surface dark:text-on-surface" type="compass" size="md" />
					<div role="heading" class="font-headings text-h3 font-semibold">{{ $t('menu.discover') }}</div>
				</div>
			</div>
			<div class="relative">
				<input
					type="text"
					v-model="searchQuery"
					:placeholder="$t('others.search_rooms')"
					class="focus bg-surface text-on-surface placeholder-on-surface-dim text-label focus:placeholder-on-surface-variant focus:ring-accent-primary mb-4 w-full rounded-xs border px-4 py-2"
				/>
				<Icon type="magnifying-glass" class="text-on-surface-variant pointer-events-none absolute top-[20%] right-2 z-10" size="sm" />
			</div>
		</div>

		<!-- Room grid -->
		<div v-if="roomsLoaded" class="flex w-full flex-col gap-2">
			<div class="flex w-full justify-center rounded-xl py-8">
				<TransitionGroup v-if="filteredRooms.length > 0" name="room-grid" tag="div" class="3xl:grid-cols-3 grid w-full grid-cols-1 gap-8 px-0 transition-all duration-300 md:grid-cols-2 lg:px-16">
					<RoomCard
						v-for="room in filteredRooms"
						:key="room.room_id"
						:room="room"
						:isSecured="rooms.publicRoomIsSecure(room.room_id)"
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
		<div>
			<InlineSpinner v-if="!roomsLoaded" class="mx-auto w-full" />
		</div>
	</div>
</template>
<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, onMounted, ref, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import RoomCard from '@hub-client/components/rooms/RoomCard.vue';
	import HubBanner from '@hub-client/components/ui/HubBanner.vue';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';

	const pubhubsStore = usePubhubsStore();
	const hubSettings = useHubSettings();
	const rooms = useRooms();
	const { t } = useI18n();
	const timestamps = ref<any[]>(rooms.roomtimestamps);
	const roomTimestamps = ref<Record<string, Date>>({});
	const expandedCardId = ref<string | null>(null);
	const searchQuery = ref('');
	let roomsLoaded = ref(true);

	type TVisiblePublicRoom = TPublicRoom & {
		nameToLower: string;
		topicToLower: string;
	};

	let visiblePublicRooms = ref<TVisiblePublicRoom[]>([]);

	const filteredRooms = computed(() => {
		const query = searchQuery.value.toLowerCase().trim();
		return visiblePublicRooms.value.filter((room) => room.nameToLower.includes(query) || room.topicToLower.includes(query));
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
		roomsLoaded.value = false;
		await rooms.fetchPublicRooms();
		roomsLoaded.value = true;

		// for quicker searching: add tolower name and topic
		visiblePublicRooms.value = rooms.visiblePublicRooms.map((room) => ({
			...room,
			nameToLower: room.name?.toLowerCase() ?? '',
			topicToLower: room.topic?.toLowerCase() ?? '',
		}));
	});
</script>
