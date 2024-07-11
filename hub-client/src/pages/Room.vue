<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin === false">
			<template #header>
				<div class="h-full pl-20 md:px-6">
					<div class="flex justify-between relative gap-x-2 h-full w-full border-b pb-2 md:pb-4 md:pr-3">
						<div v-if="rooms.currentRoom" class="flex shrink-0 gap-x-1 md:gap-x-4 items-end md:items-center w-9/12 overflow-hidden">
							<Icon :type="rooms.currentRoom.isSecuredRoom() ? 'lock' : 'room'" class="text-blue md:mt-2 shrink-0" size="lg"></Icon>
							<div class="flex flex-col">
								<TruncatedText>
									<H1 class="m-0 text-hub-accent md:text-xl">
										<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="members"></PrivateRoomName>
										<template v-else>
											{{ $t('rooms.room') }}
											<RoomName :room="rooms.currentRoom"></RoomName>
										</template>
									</H1>
								</TruncatedText>
								<TruncatedText>
									<p class="text-sm leading-4 hidden md:block">
										<PrivateRoomName v-if="rooms.currentRoom.isPrivateRoom()" :members="members"></PrivateRoomName>
										<span v-else>
											{{ getTopic() }}
										</span>
									</p>
								</TruncatedText>
							</div>
						</div>
						<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId"></SearchInput>
					</div>
				</div>
			</template>

			<RoomTimeline v-if="rooms.rooms[id!]" class="scrollbar" :room="rooms.rooms[id!]" :scroll-to-event-id="scrollToEventId" @scrolled-to-event-id="scrollToEventId = ''"></RoomTimeline>

			<template #footer>
				<MessageInput></MessageInput>
			</template>
		</HeaderFooter>

		<!-- Plugin Room -->
		<component v-if="plugin !== false && plugin !== true" :is="plugin.component"></component>
	</template>
</template>

<script setup lang="ts">
	import { onMounted, watch, ref } from 'vue';
	import { useRoute } from 'vue-router';
	import { useI18n } from 'vue-i18n';
	import { useHubSettings, useRooms } from '@/store/store';
	import { PluginProperties, usePlugins } from '@/store/plugins';
	import { TRoomMember } from '@/store/rooms';
	import { TSearchParameters } from '@/model/model';
	import { useToggleMenu } from '@/store/toggleGlobalMenu';

	const route = useRoute();
	const { t } = useI18n();
	const rooms = useRooms();
	const plugins = usePlugins();
	const plugin = ref(false as boolean | PluginProperties);
	const toggleMenu = useToggleMenu();

	const members = ref<TRoomMember[]>([]);

	const searchParameters = ref<TSearchParameters>([]);
	const scrollToEventId = ref<string>('');

	//Passed by the router
	const props = defineProps({
		id: String,
	});

	onMounted(() => {
		update();
	});

	watch(route, () => {
		update();
	});

	function update() {
		// REFACTOR NEEDED: https://gitlab.science.ru.nl/ilab/pubhubs_canonical/-/issues/783
		if (useHubSettings().mobileHubMenu) {
			toggleMenu.toggleGlobalMenu();
		}

		//We know the property is there since passed by the router, so we can use '!'
		rooms.changeRoom(props.id!);
		if (!rooms.currentRoom) return;
		if (rooms.currentRoom.isPrivateRoom()) {
			members.value = rooms.currentRoom.getOtherJoinedAndInvitedMembers() || [];
		} else {
			members.value = rooms.currentRoom.getOtherJoinedMembers() || [];
		}
		plugin.value = plugins.hasRoomPlugin(rooms.currentRoom);

		searchParameters.value.roomId = props.id!;
	}

	function getTopic() {
		if (!rooms.currentRoom) return '';
		if (rooms.currentRoom.isPrivateRoom()) {
			return t('rooms.private_members', members.value);
		}
		return rooms.currentRoom.getTopic();
	}

	async function onScrollToEventId(ev: any) {
		scrollToEventId.value = ev.eventId;
	}
</script>
