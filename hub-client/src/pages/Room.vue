<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin === false">
			<template #header>
				<div class="h-full pl-20 md:px-6 border-b">
					<div class="flex justify-between relative gap-x-2 h-full w-full">
						<div v-if="rooms.currentRoom" class="flex shrink-0 gap-x-1 md:gap-x-4 items-center w-[75%] md:w-[60%] overflow-hidden">
							<Icon :type="rooms.currentRoom.isSecuredRoom() ? 'lock' : 'room'" class="text-blue shrink-0" size="lg"></Icon>
							<div class="flex flex-col">
								<H1 class="flex text-hub-accent">
									<TruncatedText>
										{{ $t('rooms.room') }}
										<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="rooms.currentRoom.getOtherJoinedAndInvitedMembers()"></PrivateRoomName>
										<RoomName v-else :room="rooms.currentRoom"></RoomName>
									</TruncatedText>
								</H1>
								<TruncatedText class="hidden md:inline">
									<RoomTopic :room="rooms.currentRoom"></RoomTopic>
								</TruncatedText>
							</div>
						</div>
						<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId"></SearchInput>
					</div>
				</div>
			</template>

			<RoomTimeline v-if="room" :room="room" :scroll-to-event-id="scrollToEventId" @scrolled-to-event-id="scrollToEventId = ''"></RoomTimeline>

			<template #footer>
				<MessageInput v-if="room" :room="room"></MessageInput>
			</template>
		</HeaderFooter>

		<!-- Plugin Room -->
		<component v-if="plugin !== false && plugin !== true" :is="plugin.component"></component>
	</template>
</template>

<script setup lang="ts">
	import { onMounted, watch, ref, computed } from 'vue';
	import { useRoute, useRouter } from 'vue-router';
	import { useRooms, useHubSettings } from '@/store/store';
	import { PluginProperties, usePlugins } from '@/store/plugins';
	import { TSearchParameters } from '@/model/model';

	const route = useRoute();
	const rooms = useRooms();
	const router = useRouter();
	const plugins = usePlugins();
	const plugin = ref(false as boolean | PluginProperties);
	const hubSettings = useHubSettings();

	//Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	const searchParameters = ref<TSearchParameters>({ roomId: props.id, term: '' });
	const scrollToEventId = ref<string>('');

	const room = computed(() => {
		let r = rooms.rooms[props.id];
		if (!r) {
			// I want the side effect that should be avoided according to the lint rule.
			// eslint-disable-next-line
			router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find_room' } });
		}
		return r;
	});

	onMounted(() => {
		update();
	});

	watch(route, () => {
		update();
	});

	function update() {
		hubSettings.hideBar();
		rooms.changeRoom(props.id);
		if (!rooms.currentRoom) return;
		searchParameters.value.roomId = rooms.currentRoom.roomId;
		plugin.value = plugins.hasRoomPlugin(rooms.currentRoom);
	}

	async function onScrollToEventId(ev: any) {
		scrollToEventId.value = ev.eventId;
	}
</script>
