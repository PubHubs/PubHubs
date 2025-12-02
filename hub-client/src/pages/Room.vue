<template>
	<template v-if="rooms.currentRoomExists">
		<HeaderFooter :headerSize="'sm'" :headerMobilePadding="true" bgBarLow="bg-background" bgBarMedium="bg-surface-low">
			<template #header>
				<div class="text-on-surface-dim items-center gap-4" :class="isMobile ? 'hidden' : 'flex'">
					<span class="font-semibold uppercase">{{ $t('rooms.room') }}</span>
					<hr class="bg-on-surface-dim h-[2px] grow" />
				</div>
				<div class="relative flex h-full items-center justify-between gap-4" :class="isMobile ? 'pl-8' : 'pl-0'" data-testid="roomheader">
					<div v-if="rooms.currentRoom && !isSearchBarExpanded" class="flex w-fit items-center gap-3 overflow-hidden" data-testid="roomtype">
						<Icon v-if="!notPrivateRoom()" type="caret-left" data-testid="back" class="cursor-pointer" @click="router.push({ name: 'direct-msg' })" />
						<Icon v-if="showLibrary" type="caret-left" size="base" @click.stop="toggleLibrary" class="cursor-pointer" />
						<Icon v-if="showLibrary" type="folder-simple" size="base" data-testid="roomlibrary-icon" />
						<Icon v-else-if="notPrivateRoom()" :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'chats-circle'" />
						<div class="flex flex-col">
							<H3 class="text-on-surface flex">
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
							<GlobalBarButton v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" type="folder-simple" :selected="showLibrary" @click="toggleLibrary"></GlobalBarButton>
							<GlobalBarButton type="users" :selected="showMembers" @click="toggleMembersList"></GlobalBarButton>
							<!--Only show Editing icon for steward but not for administrator-->
							<GlobalBarButton v-if="room.getUserPowerLevel(user.userId) === 50" type="dots-three-vertical" @click="stewardCanEdit()" />
							<!--Except for moderator everyone should talk to room moderator e.g., admins-->
							<GlobalBarButton v-if="room.getUserPowerLevel(user.userId) !== 50 && room.getRoomStewards().length > 0" type="chat-circle" @click="messageRoomSteward()" />
						</RoomHeaderButtons>
						<SearchInput :search-parameters="searchParameters" @scroll-to-event-id="onScrollToEventId" @toggle-searchbar="handleToggleSearchbar" @search-started="showMembers = false" :room="rooms.currentRoom" />
					</div>
				</div>
			</template>

			<div class="flex h-full w-full justify-between overflow-hidden">
				<RoomLibrary v-if="showLibrary" :room="room" @close="toggleLibrary"></RoomLibrary>
				<div class="flex h-full w-full flex-col overflow-hidden" :class="{ hidden: showLibrary }">
					<RoomTimeline v-if="room" ref="roomTimeLineComponent" :room="room" @scrolled-to-event-id="room.setCurrentEvent(undefined)"> </RoomTimeline>
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
	</template>
	<!-- Secure room join dialog -->
	<RoomLoginDialog v-if="joinSecuredRoom" v-model:dialogOpen="joinSecuredRoom" title="rooms.join_room" message="rooms.join_secured_room_dialog" :messageValues="[]" :secured="true" @close="router.push({ name: 'home' })" />
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

	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	import { ScrollPosition } from '@hub-client/models/constants';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	// Models
	import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
	import { TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';
	import { TSearchParameters } from '@hub-client/models/search/TSearch';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const router = useRouter();
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
	const roomTimeLineComponent = ref<InstanceType<typeof RoomTimeline> | null>(null);

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
			return undefined;
		}
		// the name of the room will be synced later, start with an empty name
		if (r.name === props.id) {
			r.name = '';
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
			// for scrolling back to this room: save the id of the first visible event
			const firstEventId = getFirstVisibleEventId();
			if (firstEventId) {
				rooms.scrollPositions[rooms.currentRoom.roomId] = firstEventId ?? '';
			}
			rooms.currentRoom.setCurrentThreadId(undefined); // reset current thread
			rooms.currentRoom.setCurrentEvent(undefined); // reset current event
		}
		update();
	});

	/**
	 * Gets the Event Id of the first visible event in the roomtimeline
	 * Needed to save the current scrollposition
	 */
	function getFirstVisibleEventId(): string | null {
		const container = roomTimeLineComponent.value?.elRoomTimeline;
		if (!container) return null;

		const containerRect = container.getBoundingClientRect();

		for (const child of Array.from(container.querySelectorAll('[id]'))) {
			const rect = (child as HTMLElement).getBoundingClientRect();
			if (rect.bottom > containerRect.top) {
				return (child as HTMLElement).id;
			}
		}
		return null;
	}

	function currentThreadLengthChanged(newLength: number) {
		room.value.setCurrentThreadLength(newLength);
	}

	async function update() {
		await rooms.waitForInitialRoomsLoaded();

		hubSettings.hideBar();
		rooms.changeRoom(props.id);
		const userIsMember = await pubhubs.isUserRoomMember(user.userId!, props.id);
		if (!userIsMember) {
			let promise = null;
			await rooms.fetchPublicRooms();
			const roomIsSecure = rooms.roomIsSecure(props.id);

			// For secured rooms users first have to authenticate
			if (roomIsSecure) {
				joinSecuredRoom.value = props.id;
			}
			// Non-secured rooms can be joined immediately
			else {
				promise = pubhubs.joinRoom(props.id);
			}
			// need this extra check
			if (promise) {
				// Room does not exist or user failed to join room
				promise.catch(() => {
					router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find' } });
				});
			}
		}

		if (!rooms.currentRoom) return;

		// Initialize syncing of room
		rooms.currentRoom.initTimeline();

		searchParameters.value.roomId = rooms.currentRoom.roomId;

		// If there is a position saved in scrollPositions for this room: go there
		// otherwise go to the newest event
		const timeline = roomTimeLineComponent.value?.elRoomTimeline;
		const savedPosition = rooms.scrollPositions[rooms.currentRoom.roomId];

		if (timeline && savedPosition) {
			rooms.currentRoom.setCurrentEvent({
				eventId: savedPosition,
				position: ScrollPosition.Start,
			});
		} else {
			const lastEventId = rooms.currentRoom.getRoomNewestMessageId() ?? '';
			rooms.currentRoom.setCurrentEvent({
				eventId: lastEventId,
				position: ScrollPosition.End,
			});
		}
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
		// We need to fetch latest public created rooms.
		const currentPublicRooms = await pubhubs.getAllPublicRooms();

		currentRoomToEdit.value = currentPublicRooms.find((room) => room.room_id === props.id);

		// If room is not there then don't show dialog box. Throw an error.
		if (currentRoomToEdit.value) {
			if (currentRoomToEdit.value?.room_type === RoomType.PH_MESSAGES_RESTRICTED) {
				secured.value = true;
			}
			showEditRoom.value = true;
		} else {
			router.push({
				name: 'error-page',
				query: { errorKey: 'errors.cant_find_room' },
			});
		}
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
