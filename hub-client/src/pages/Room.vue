<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter v-if="plugin === false" :headerSize="'sm'" :headerMobilePadding="true" bgBarLow="bg-background" bgBarMedium="bg-surface-low">
			<template #header>
				<div class="items-center gap-4 text-on-surface-dim" :class="isMobile ? 'hidden' : 'flex'">
					<span class="font-semibold uppercase">{{ $t('rooms.room') }}</span>
					<hr class="h-[2px] grow bg-on-surface-dim" />
				</div>
				<div class="relative flex h-full items-center justify-between gap-4" :class="isMobile ? 'pl-8' : 'pl-0'">
					<div v-if="rooms.currentRoom && !isSearchBarExpanded" class="flex w-fit items-center gap-3 overflow-hidden">
						<Icon v-if="!notPrivateRoom()" type="back" size="base" @click="router.push('/direct-msg')" />
						<Icon v-if="notPrivateRoom()" :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'speech_bubbles'" size="base" />
						<div class="flex flex-col">
							<H3 class="flex text-on-surface">
								<TruncatedText class="font-headings font-semibold">
									<PrivateRoomHeader v-if="room.isPrivateRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<GroupRoomHeader v-else-if="room.isGroupRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<AdminContactRoomHeader v-else-if="room.isAdminContactRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<RoomName v-else :room="rooms.currentRoom" />
								</TruncatedText>
							</H3>
							<TruncatedText class="hidden md:inline">
								<!-- <RoomTopic :room="rooms.currentRoom"/> -->
							</TruncatedText>
						</div>
					</div>
					<div class="flex gap-4" :class="{ 'w-full': isSearchBarExpanded }">
						<RoomHeaderButtons>
							<GlobalBarButton type="two_users" size="sm" :selected="showMembers" @click="toggleMembersList"></GlobalBarButton>
							<!--Only show Editing icon for steward but not for administrator-->
							<GlobalBarButton v-if="room.getUserPowerLevel(user.user.userId) === 50" type="cog" size="sm" @click="stewardCanEdit()" />
						</RoomHeaderButtons>
						<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId" @toggle-searchbar="handleToggleSearchbar" :room="rooms.currentRoom" />
					</div>
				</div>
			</template>
			<div class="flex h-full w-full justify-between overflow-hidden">
				<div class="flex h-full w-full flex-col overflow-hidden">
					<RoomTimeline v-if="room" :room="room" :scroll-to-event-id="room.getCurrentEventId()" @scrolled-to-event-id="room.setCurrentEventId(undefined)"> </RoomTimeline>
				</div>
				<RoomThread v-if="room.getCurrentThreadId()" :room="room" :scroll-to-event-id="room.getCurrentEventId()" @scrolled-to-event-id="room.setCurrentEventId(undefined)" @thread-length-changed="currentThreadLengthChanged">
				</RoomThread>
				<RoomMemberList v-if="showMembers" :room="room" @close="toggleMembersList"></RoomMemberList>
			</div>

			<template #footer>
				<EditRoomForm v-if="showEditRoom" :room="currentRoomToEdit" :secured="secured" @close="closeEdit()" />
			</template>
		</HeaderFooter>

		<!-- Plugin Room -->
		<component v-if="plugin !== false && plugin !== true" :is="plugin.component" />
	</template>
</template>

<script setup lang="ts">
	// Components
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import Icon from '@/components/elements/Icon.vue';
	import H3 from '@/components/elements/H3.vue';
	import TruncatedText from '@/components/elements/TruncatedText.vue';
	import PrivateRoomHeader from '@/components/rooms/PrivateRoomHeader.vue';
	import GroupRoomHeader from '@/components/rooms/GroupRoomHeader.vue';
	import AdminContactRoomHeader from '@/components/rooms/AdminContactRoomHeader.vue';
	import SearchInput from '@/components/forms/SearchInput.vue';
	import RoomTimeline from '@/components/rooms/RoomTimeline.vue';
	import RoomName from '@/components/rooms/RoomName.vue';
	import RoomThread from '@/components/rooms/RoomThread.vue';
	import GlobalBarButton from '@/components/ui/GlobalbarButton.vue';
	import RoomHeaderButtons from '@/components/rooms/RoomHeaderButtons.vue';
	import RoomMemberList from '@/components/rooms/RoomMemberList.vue';

	import { usePubHubs } from '@/logic/core/pubhubsStore';
	import { LOGGER } from '@/logic/foundation/Logger';
	import { SMI } from '@/logic/foundation/StatusMessage';
	import { TSearchParameters } from '@/model/search/TSearch';
	import { useHubSettings } from '@/logic/store/hub-settings';
	import { PluginProperties, usePlugins } from '@/logic/store/plugins';
	import { useRooms } from '@/logic/store/rooms';
	import { useUser } from '@/logic/store/user';
	import { TPublicRoom } from '@/model/rooms/TPublicRoom';
	import { TSecuredRoom } from '@/model/rooms/TSecuredRoom';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';
	import { useSettings } from '@/logic/store/settings';

	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const router = useRouter();
	const plugins = usePlugins();
	const plugin = ref<boolean | PluginProperties>(false);
	const hubSettings = useHubSettings();
	const currentRoomToEdit = ref<TSecuredRoom | TPublicRoom | null>(null);
	const showEditRoom = ref(false);
	const showMembers = ref(false);
	const secured = ref(false);
	const isSearchBarExpanded = ref<boolean>(false);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const pubhubs = usePubHubs();

	//Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	const searchParameters = ref<TSearchParameters>({ roomId: props.id, term: '' });

	const room = computed(() => {
		let r = rooms.rooms[props.id];
		if (!r) {
			// I want the side effect that should be avoided according to the lint rule.
			// eslint-disable-next-line
			router.push({
				name: 'error-page',
				query: { errorKey: 'errors.cant_find_room' },
			});
		}
		return r;
	});

	const handleToggleSearchbar = (isExpanded: boolean) => {
		isSearchBarExpanded.value = isExpanded;
	};

	onMounted(() => {
		update();
		LOGGER.log(SMI.ROOM, `Room mounted `);
	});

	watch(route, () => {
		if (rooms.currentRoom) {
			rooms.currentRoom.setCurrentThreadId(undefined); // reset current thread
			rooms.currentRoom.setCurrentEventId(undefined); // reset current event
		}
		update();
	});

	function currentThreadLengthChanged(newLength: number) {
		room.value.setCurrentThreadLength(newLength);
	}

	async function update() {
		hubSettings.hideBar();
		rooms.changeRoom(props.id);

		const userIsMemberOfRoom = await pubhubs.isUserRoomMember(user.user.userId, props.id);
		if (!userIsMemberOfRoom) {
			// if not a member: try to join, otherwise go to the hubpage
			pubhubs.joinRoom(props.id).catch(() => router.push({ name: 'hubpage' }));
		}

		if (!rooms.currentRoom) return;
		searchParameters.value.roomId = rooms.currentRoom.roomId;
		plugin.value = plugins.hasRoomPlugin(rooms.currentRoom);
	}

	async function onScrollToEventId(ev: any) {
		// if there is a threadId and this is a valid id in the room: set the current threadId
		if (ev.threadId && ev.threadId !== ev.eventId) {
			if (!room.value.findEventById(ev.threadId)) {
				try {
					await room.value.loadToEvent(ev.threadId);
				} catch (e) {
					LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${eventId}`);
				}
			}
			room.value.setCurrentThreadId(ev.threadId);
		} else {
			room.value.setCurrentThreadId(undefined);
		}
		room.value.setCurrentEventId(ev.eventId);
	}

	async function stewardCanEdit() {
		currentRoomToEdit.value = await rooms.getTPublicOrTSecuredRoom(props.id);
		const isSecuredRoom = rooms.roomIsSecure(props.id);
		if (isSecuredRoom) secured.value = true;
		showEditRoom.value = true;
	}

	function closeEdit() {
		showEditRoom.value = false;
		secured.value = false;
	}

	function notPrivateRoom() {
		return !room.value.isPrivateRoom() && !room.value.isGroupRoom() && !room.value.isAdminContactRoom();
	}

	function toggleMembersList() {
		showMembers.value = !showMembers.value;
	}
</script>
