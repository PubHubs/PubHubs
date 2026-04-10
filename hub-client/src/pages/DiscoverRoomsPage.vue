<template>
	<HeaderFooter>
		<template #header>
			<div
				class="flex h-full items-center"
				:class="isMobile ? 'pl-4' : 'pl-0'"
			>
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="compass" />
					<H3 class="font-headings text-h3 text-on-surface font-semibold">
						{{ $t('menu.discover') }}
					</H3>
				</div>
			</div>
		</template>

		<div class="mx-auto my-10 flex w-full flex-col gap-4 px-8 md:w-4/6 md:px-0">
			<!-- Search bar -->
			<div class="mb-4">
				<div class="relative w-full md:ml-auto md:w-[320px]">
					<input
						v-model="searchQuery"
						class="outline-offset-thin outline-on-surface-dim focus:ring-button-blue text-on-surface placeholder-on-surface-dim w-full rounded px-175 py-100 pr-10 outline focus:ring-3 focus:outline-none"
						:placeholder="$t('others.search_rooms')"
						type="text"
						@keyup="startFilter"
					/>
					<Icon
						v-if="!searchQuery"
						type="magnifying-glass"
						size="sm"
						class="text-on-surface-dim pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
					/>
					<button
						v-else
						type="button"
						class="text-on-surface-dim hover:text-on-surface absolute top-1/2 right-3 -translate-y-1/2"
						:aria-label="t('others.clear_search')"
						@click="clearSearch"
					>
						<Icon
							type="x"
							size="sm"
						/>
					</button>
				</div>
			</div>

			<InlineSpinner
				v-if="!roomsLoaded || isFiltering"
				class="mx-auto w-full"
			/>

			<!-- Room grid -->
			<div
				v-if="roomsLoaded"
				class="@container flex w-full flex-col gap-2"
			>
				<div class="flex w-full justify-center rounded-xl pb-8">
					<TransitionGroup
						v-if="filteredRooms.length > 0"
						class="grid w-full grid-cols-1 gap-8 transition-all duration-300 @2xl:grid-cols-2 @7xl:grid-cols-3"
						name="room-grid"
						tag="div"
					>
						<RoomCard
							v-for="room in filteredRooms"
							:key="room.room_id"
							:is-secured="rooms.publicRoomIsSecure(room.room_id)"
							:member-of-room="rooms.memberOfPublicRoom(room.room_id)"
							:room="room"
							:timestamp="roomTimestamps[room.room_id]"
						/>
					</TransitionGroup>

					<!-- No results message -->
					<div
						v-else
						class="flex w-full items-center justify-center"
					>
						<P>{{ t('rooms.no_rooms_found') }}</P>
					</div>
				</div>
			</div>
		</div>
	</HeaderFooter>
</template>

<script lang="ts" setup>
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
	import { type TPublicRoom, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';

	const pubhubsStore = usePubhubsStore();
	const rooms = useRooms();
	const { t } = useI18n();
	const timestamps = ref<Array<Array<number | string>>>(rooms.roomtimestamps);
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
	const filterTimer = ref<ReturnType<typeof setTimeout>>();
	const isFiltering = ref(false);
	const filterTimeOut = 400;

	const clearSearch = () => {
		searchQuery.value = '';
		startFilter();
	};

	const startFilter = () => {
		clearTimeout(filterTimer.value);
		isFiltering.value = true;
		filterTimer.value = setTimeout(() => {
			const query = searchQuery.value.toLowerCase().trim();
			if (query === '') {
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
				timestampMap[timestamp[1]] = new Date(timestamp[0]);
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
