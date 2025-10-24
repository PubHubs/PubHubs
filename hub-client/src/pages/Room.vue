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
						<Icon v-if="!notPrivateRoom()" type="back" size="base" @click="router.back()" />
						<Icon v-if="notPrivateRoom()" :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'speech_bubbles'" size="base" />
						<div class="flex flex-col">
							<H3 class="flex text-on-surface">
								<TruncatedText class="font-headings font-semibold">
									<PrivateRoomHeader v-if="room.isPrivateRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<GroupRoomHeader v-else-if="room.isGroupRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<AdminContactRoomHeader v-else-if="room.isAdminContactRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<StewardContactRoomHeader v-else-if="room.isStewardContactRoom()" :room="room" :members="room.getOtherJoinedAndInvitedMembers()" />
									<RoomName v-else :room="rooms.currentRoom" />
								</TruncatedText>
							</H3>
							<TruncatedText class="hidden md:inline"> </TruncatedText>
						</div>
					</div>
					<div class="flex gap-4" :class="{ 'w-full': isSearchBarExpanded }">
						<RoomHeaderButtons>
							<GlobalBarButton v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" type="folder" size="sm" :selected="showLibrary" @click="toggleLibrary"></GlobalBarButton>
							<GlobalBarButton type="two_users" size="sm" :selected="showMembers" @click="toggleMembersList"></GlobalBarButton>
							<!--Only show Editing icon for steward but not for administrator-->
							<GlobalBarButton v-if="room.getUserPowerLevel(user.userId) === 50" type="cog" size="sm" @click="stewardCanEdit()" />
							<!--Except for moderator everyone should talk to room moderator e.g., admins-->
							<GlobalBarButton v-if="room.getUserPowerLevel(user.userId) !== 50 && room.getRoomStewards().length > 0" type="moderator_msg" size="sm" @click="messageRoomSteward()" />
						</RoomHeaderButtons>
						<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId" @toggle-searchbar="handleToggleSearchbar" @search-started="showMembers = false" :room="rooms.currentRoom" />
					</div>
				</div>
			</template>

			<div class="flex h-full w-full justify-between overflow-hidden">
				<RoomLibrary v-if="showLibrary" :id="id" @close="toggleLibrary"></RoomLibrary>
				<div class="flex h-full w-full flex-col overflow-hidden" :class="{ hidden: showLibrary }">
					<RoomTimeline v-if="room" :room="room" :scroll-to-event-id="room.getCurrentEvent()" @scrolled-to-event-id="room.setCurrentEvent(undefined)"> </RoomTimeline>
				</div>
				<RoomThread
					v-if="room.getCurrentThreadId()"
					:class="{ hidden: showLibrary }"
					:room="room"
					:scroll-to-event-id="room.getCurrentEvent()?.eventId"
					@scrolled-to-event-id="room.setCurrentEvent(undefined)"
					@thread-length-changed="currentThreadLengthChanged"
				>
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
	<!-- Secure room join dialog -->
	<SecuredRoomLoginDialog v-if="joinSecuredRoom" v-model:dialogOpen="joinSecuredRoom" title="rooms.join_room" message="rooms.join_secured_room_dialog" :messageValues="[]" @close="router.push({ name: 'home' })" />
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useRoute, useRouter } from 'vue-router';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import SearchInput from '@hub-client/components/forms/SearchInput.vue';
	import AdminContactRoomHeader from '@hub-client/components/rooms/AdminContactRoomHeader.vue';
	import EditRoomForm from '@hub-client/components/rooms/EditRoomForm.vue';
	import GroupRoomHeader from '@hub-client/components/rooms/GroupRoomHeader.vue';
	import PrivateRoomHeader from '@hub-client/components/rooms/PrivateRoomHeader.vue';
	import RoomHeaderButtons from '@hub-client/components/rooms/RoomHeaderButtons.vue';
	import RoomLibrary from '@hub-client/components/rooms/RoomLibrary.vue';
	import RoomMemberList from '@hub-client/components/rooms/RoomMemberList.vue';
	import RoomName from '@hub-client/components/rooms/RoomName.vue';
	import RoomThread from '@hub-client/components/rooms/RoomThread.vue';
	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';
	import StewardContactRoomHeader from '@hub-client/components/rooms/StewardContactRoomHeader.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';

	import { routes } from '@hub-client/logic/core/router';
	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
	import { TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';
	import { TSearchParameters } from '@hub-client/models/search/TSearch';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { PluginProperties, usePlugins } from '@hub-client/stores/plugins';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const router = useRouter();
	const plugins = usePlugins();
	const plugin = ref(false as boolean | PluginProperties);
	const hubSettings = useHubSettings();
	const currentRoomToEdit = ref<TSecuredRoom | TPublicRoom | null>(null);
	const showEditRoom = ref(false);
	const showMembers = ref(false);
	const showLibrary = ref(false);
	const secured = ref(false);
	const isSearchBarExpanded = ref<boolean>(false);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const pubhubs = usePubhubsStore();
	const joinSecuredRoom = ref<string | null>(null);

	// Passed by the router
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

	// const roomLibrary = computed (() => {
	// 	return rooms.rooms[props.id].getRoomLibrary();
	// })

	onMounted(() => {
		update();
		LOGGER.log(SMI.ROOM, `Room mounted `);
	});

	watch(route, () => {
		if (rooms.currentRoom) {
			rooms.currentRoom.setCurrentThreadId(undefined); // reset current thread
			rooms.currentRoom.setCurrentEvent(undefined); // reset current event
		}
		update();
	});

	function currentThreadLengthChanged(newLength: number) {
		room.value.setCurrentThreadLength(newLength);
	}

	async function update() {
		hubSettings.hideBar();
		rooms.changeRoom(props.id);

		const userIsMemberOfRoom = await pubhubs.isUserRoomMember(user.userId!, props.id);
		if (!userIsMemberOfRoom) {
			const promise = pubhubs.joinRoom(props.id);
			// need this extra check
			if (promise) {
				if (rooms.roomIsSecure(props.id)) {
					promise.catch(() => (joinSecuredRoom.value = props.id));
				} else {
					promise.catch(() => {
						// Redirect to route with name equal to props.id (except 'room'), or to home
						const isValidRoute = routes.some((r) => r.name === props.id && r.name !== 'room');
						router.push({ name: isValidRoute ? props.id : 'home' });
					});
				}
			}
		}

		if (!rooms.currentRoom) return;

		/* Initialize syncing of room */
		rooms.currentRoom.initTimeline();

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
					LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${ev.thread}`);
				}
			}
			room.value.setCurrentThreadId(ev.threadId);
		} else {
			room.value.setCurrentThreadId(undefined);
		}
		room.value.setCurrentEvent({ eventId: ev.eventId, threadId: undefined });
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
		return !room.value.isPrivateRoom() && !room.value.isGroupRoom() && !room.value.isAdminContactRoom() && !room.value.isStewardContactRoom();
	}

	function toggleMembersList() {
		showMembers.value = !showMembers.value;
	}

	async function messageRoomSteward() {
		const members = room.value.getRoomStewards();
		await rooms.createStewardRoomOrModify(props.id, members);
	}

	function toggleLibrary() {
		showLibrary.value = !showLibrary.value;
	}
</script>
