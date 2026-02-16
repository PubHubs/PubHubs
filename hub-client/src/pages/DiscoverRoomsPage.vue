<template>
	<HeaderFooter>
		<template #header>
			<div class="flex h-full items-center" :class="isMobile ? 'pl-4' : 'pl-0'">
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="compass" />
					<H3 class="font-headings text-h3 text-on-surface font-semibold">{{ $t('menu.discover') }}</H3>
				</div>
			</div>
		</template>

		<div class="mx-auto my-16 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
			<!-- Search bar -->
			<div class="flex flex-col gap-2">
				<input
					type="text"
					v-model="searchQuery"
					:placeholder="$t('others.search_rooms')"
					class="focus bg-surface text-on-surface placeholder-on-surface-dim text-label focus:placeholder-on-surface-variant focus:ring-accent-primary mb-4 w-full rounded-xs border px-4 py-2"
					@keyup="startFilter"
				/>
			</div>

			<div class="h-4">
				<InlineSpinner v-if="!roomsLoaded || isFiltering" class="mx-auto w-full" />
			</div>

			<!-- Room grid -->
			<div v-if="roomsLoaded" class="@container flex w-full flex-col gap-2">
				<div class="flex w-full justify-center rounded-xl py-8">
					<TransitionGroup v-if="filteredRooms.length > 0" name="room-grid" tag="div" class="grid w-full grid-cols-1 gap-8 transition-all duration-300 @2xl:grid-cols-2 @7xl:grid-cols-3">
						<RoomCard
							v-for="room in filteredRooms"
							:key="room.room_id"
							:room="room"
							:isSecured="rooms.publicRoomIsSecure(room.room_id)"
							:memberOfRoom="rooms.memberOfPublicRoom(room.room_id)"
							:timestamp="roomTimestamps[room.room_id]"
						/>
					</TransitionGroup>

					<!-- No results message -->
					<div v-else class="flex w-full items-center justify-center">
						<P>{{ t('rooms.no_rooms_found') }}</P>
					</div>
				</div>
			</div>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { computed, onBeforeMount, onMounted, ref, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import P from '@hub-client/components/elements/P.vue';
	import RoomCard from '@hub-client/components/rooms/RoomCard.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { TPublicRoom, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const pubhubsStore = usePubhubsStore();
	const rooms = useRooms();
	const { t } = useI18n();
	const timestamps = ref<any[]>(rooms.roomtimestamps);
	const roomTimestamps = ref<Record<string, Date>>({});
	const searchQuery = ref('');
	let roomsLoaded = ref(true);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	type TVisiblePublicRoom = TPublicRoom & {
		nameToLower: string;
		topicToLower: string;
	};

	const visiblePublicRooms = ref<TVisiblePublicRoom[]>([]);
	const filteredRooms = ref<TVisiblePublicRoom[]>([]);
	const filterTimer = ref();
	const isFiltering = ref(false);
	const filterTimeOut = 400;

	const startFilter = () => {
		clearTimeout(filterTimer.value);
		isFiltering.value = true;
		filterTimer.value = setTimeout(() => {
			const query = searchQuery.value.toLowerCase().trim();
			if (query == '') {
				filteredRooms.value = visiblePublicRooms.value;
				isFiltering.value = false;
			} else {
				// filteredRooms.value = visiblePublicRooms.value.filter((room) => room.nameToLower.includes(query) || room.topicToLower.includes(query));
				filteredRooms.value = fastFilterRooms(visiblePublicRooms.value, query);
				isFiltering.value = false;
			}
		}, filterTimeOut);
	};

	// This is approx twice as fast as ES6 filter
	const fastFilterRooms = (arr: TVisiblePublicRoom[], query: string): TVisiblePublicRoom[] => {
		const filtered = [];
		for (let i = 0; i < arr.length; i++) {
			if (arr[i].nameToLower.includes(query) || arr[i].topicToLower.includes(query)) {
				filtered.push(arr[i]);
			}
		}
		return filtered;
	};

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

	async function loadTimestamps() {
		const response = await pubhubsStore.fetchTimestamps();
		if (response) {
			timestamps.value = response;
			rooms.setTimestamps(response);
		}
	}

	watchEffect(() => {
		if (timestamps.value && timestamps.value.length > 0) {
			processTimestamps();
		}
	});

	onBeforeMount(() => {
		loadTimestamps();
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
		filteredRooms.value = visiblePublicRooms.value;
	});
</script>
