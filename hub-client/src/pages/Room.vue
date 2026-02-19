<template>
	<div class="flex h-full flex-col">
		<template v-if="rooms.currentRoomExists">
			<div v-if="isLoading" class="flex h-full w-full items-center justify-center">
				<InlineSpinner />
			</div>
			<!-- Shared Header -->
			<div v-else class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8" :class="isMobile ? 'pl-12' : 'pl-8'" data-testid="roomheader">
				<!-- Left: Room info -->
				<div v-if="rooms.currentRoom" class="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden" data-testid="roomtype">
					<Icon v-if="!notPrivateRoom()" type="caret-left" data-testid="back" class="cursor-pointer" @click="router.push({ name: 'direct-msg' })" />
					<Icon v-else-if="notPrivateRoom()" :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'chats-circle'" />
					<div class="group relative" :class="!rooms.currentRoom.isDirectMessageRoom() && 'hover:cursor-pointer'" :title="t('menu.copy_room_url')" @click="!rooms.currentRoom.isDirectMessageRoom() && copyRoomUrl">
						<H3 class="text-on-surface flex">
							<TruncatedText class="font-headings font-semibold">
								<PrivateRoomHeader v-if="room!.isPrivateRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
								<GroupRoomHeader v-else-if="room!.isGroupRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
								<AdminContactRoomHeader v-else-if="room!.isAdminContactRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
								<StewardContactRoomHeader v-else-if="room!.isStewardContactRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
								<RoomName v-else :room="rooms.currentRoom" :title="t('menu.copy_room_url')" />
							</TruncatedText>
						</H3>
						<Icon type="copy" size="sm" class="text-on-surface-dim group-hover:text-on-surface absolute top-0 -right-2" />
					</div>
				</div>

				<!-- Right: Sidebar controls -->
				<div class="flex items-center gap-2">
					<RoomHeaderButtons>
						<!-- Search -->
						<GlobalBarButton type="magnifying-glass" :selected="sidebar.activeTab.value === SidebarTab.Search" @click="sidebar.toggleTab(SidebarTab.Search)" />

						<!-- Room library -->
						<GlobalBarButton v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" type="folder-simple" :selected="sidebar.activeTab.value === SidebarTab.Library" @click="sidebar.toggleTab(SidebarTab.Library)" />

						<!-- Members -->
						<GlobalBarButton v-if="hasRoomMembers" type="users" :selected="sidebar.activeTab.value === SidebarTab.Members" @click="sidebar.toggleTab(SidebarTab.Members)" />

						<!-- Thread tab (shown when a thread is selected) -->
						<GlobalBarButton v-if="room?.getCurrentThreadId()" type="chat-circle" :selected="sidebar.activeTab.value === SidebarTab.Thread" @click="sidebar.toggleTab(SidebarTab.Thread)" />

						<!-- Editing icon for steward (but not for administrator) -->
						<GlobalBarButton v-if="hasRoomPermission(room!.getUserPowerLevel(user.userId), actions.StewardPanel)" type="dots-three-vertical" @click="stewardCanEdit()" />
					</RoomHeaderButtons>
				</div>
			</div>

			<!-- Content row: Timeline + Sidebar -->
			<div class="flex flex-1 overflow-hidden">
				<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
					<RoomTimeline v-if="room" :key="props.id" :room="room" :event-id-to-scroll="scrollToEventId" :last-read-event-id="lastReadEventId" />
				</div>

				<!-- Room sidebar -->
				<RoomSidebar :active-tab="sidebar.activeTab.value" :is-mobile="sidebar.isMobile.value">
					<RoomLibrary v-if="sidebar.activeTab.value === SidebarTab.Library" :room="room!" />
					<RoomThread
						v-if="sidebar.activeTab.value === SidebarTab.Thread && room?.getCurrentThreadId()"
						:room="room!"
						:scroll-to-event-id="room!.getCurrentEvent()?.eventId"
						@scrolled-to-event-id="room!.setCurrentEvent(undefined)"
						@thread-length-changed="currentThreadLengthChanged"
					/>
					<RoomMemberList v-if="sidebar.activeTab.value === SidebarTab.Members" :room="room!" />
					<RoomSearch v-if="sidebar.activeTab.value === SidebarTab.Search" :room="room!" @scroll-to-event-id="onScrollToEventId" />
				</RoomSidebar>
			</div>

			<!-- Footer -->
			<EditRoomForm v-if="showEditRoom" :room="currentRoomToEdit" :secured="secured" @close="closeEdit()" />
		</template>
	</div>

	<!-- Secure room join dialog -->
	<RoomLoginDialog v-if="joinSecuredRoom" v-model:dialogOpen="joinSecuredRoom" title="rooms.join_room" message="rooms.join_secured_room_dialog" :messageValues="[]" :secured="true" />
</template>

<script setup lang="ts">
	// Packages
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import AdminContactRoomHeader from '@hub-client/components/rooms/AdminContactRoomHeader.vue';
	import EditRoomForm from '@hub-client/components/rooms/EditRoomForm.vue';
	import GroupRoomHeader from '@hub-client/components/rooms/GroupRoomHeader.vue';
	import PrivateRoomHeader from '@hub-client/components/rooms/PrivateRoomHeader.vue';
	import RoomHeaderButtons from '@hub-client/components/rooms/RoomHeaderButtons.vue';
	import RoomLibrary from '@hub-client/components/rooms/RoomLibrary.vue';
	import RoomMemberList from '@hub-client/components/rooms/RoomMemberList.vue';
	import RoomName from '@hub-client/components/rooms/RoomName.vue';
	import RoomSearch from '@hub-client/components/rooms/RoomSearch.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import RoomThread from '@hub-client/components/rooms/RoomThread.vue';
	import RoomTimeline from '@hub-client/components/rooms/RoomTimeline.vue';
	import StewardContactRoomHeader from '@hub-client/components/rooms/StewardContactRoomHeader.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useClipboard } from '@hub-client/composables/useClipboard';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { LOGGER } from '@hub-client/logic/logging/Logger';
	import { SMI } from '@hub-client/logic/logging/StatusMessage';

	// Models
	import { QueryParameterKey, actions } from '@hub-client/models/constants';
	import { hasRoomPermission } from '@hub-client/models/hubmanagement/roompermissions';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
	import { TPublicRoom } from '@hub-client/models/rooms/TPublicRoom';
	import { TSecuredRoom } from '@hub-client/models/rooms/TSecuredRoom';

	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { t } = useI18n();
	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const router = useRouter();
	const hubSettings = useHubSettings();
	const { copyCurrentRoomUrl: copyRoomUrl } = useClipboard();
	const sidebar = useSidebar();
	const currentRoomToEdit = ref<TSecuredRoom | TPublicRoom | undefined>(undefined);
	const showEditRoom = ref(false);
	const secured = ref(false);
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);
	const pubhubs = usePubhubsStore();
	const joinSecuredRoom = ref<string | null>(null);
	const scrollToEventId = ref<string>();
	const isLoading = ref(true); // Keep track if the page is loading, then the template cannot be rendered yet
	let updateVersion = 0; // Used to cancel stale update() calls

	// Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	// This guarantees that room has a value, so in the template we can safely use room!
	const room = computed(() => {
		let r = rooms.rooms[props.id];
		if (!r) {
			return undefined;
		}
		// The name of the room will be synced later, start with an empty name
		if (r.name === props.id) {
			r.name = '';
		}
		return r;
	});

	const lastReadEventId = computed(() => {
		if (!room.value || !user.userId) return undefined;
		return room.value.getLastVisibleEventId() || room.value.getEventReadUpTo(user.userId) || undefined;
	});

	// Check if there are room members to show
	const hasRoomMembers = computed(() => {
		if (!room.value) return false;
		const members = room.value.getStateJoinedMembersIds();
		return members.filter((id) => !id.startsWith('@notices_user:')).length > 0;
	});

	onMounted(async () => {
		// Ensure sidebar is closed instantly when entering a room page
		sidebar.closeInstantly();
		isLoading.value = true;
		const completed = await update();

		// Handle explicit scroll requests from URL parameter
		const eventIdFromQuery = route.query[QueryParameterKey.EventId] as string | undefined;
		if (eventIdFromQuery) {
			scrollToEventId.value = eventIdFromQuery;
		} else if (rooms.scrollPositions[props.id]) {
			// Fallback to scrollPositions
			scrollToEventId.value = rooms.scrollPositions[props.id];
			// Clear it after reading so it doesn't persist
			delete rooms.scrollPositions[props.id];
		}
		if (completed) isLoading.value = false;
	});

	// Close sidebar instantly before leaving this page
	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	// Clear thread when sidebar is closed
	watch(
		() => sidebar.isOpen.value,
		(isOpen) => {
			// Only clear thread when transitioning from open to closed
			if (isOpen === false && room.value) {
				room.value.setCurrentThreadId(undefined);
			}
		},
	);

	watch(route, async () => {
		// On mobile, close sidebar when switching rooms
		if (sidebar.isMobile.value) {
			sidebar.closeInstantly();
		}

		// Check for eventId in query param on route change
		const eventIdFromQuery = route.query[QueryParameterKey.EventId] as string | undefined;
		if (eventIdFromQuery) {
			scrollToEventId.value = eventIdFromQuery;
		}
		isLoading.value = true;
		if (rooms.currentRoom) {
			// Send read receipt for last visible event before leaving
			const lastEventId = rooms.currentRoom.getLastVisibleEventId();
			if (lastEventId && settings.isFeatureEnabled(FeatureFlag.notifications)) {
				const event = rooms.currentRoom.findEventById(lastEventId);
				if (event) {
					pubhubs.sendPrivateReceipt(event, rooms.currentRoom.roomId);
				}
			}
			rooms.currentRoom.setCurrentThreadId(undefined); // reset current thread
			rooms.currentRoom.setCurrentEvent(undefined); // reset current event
		}
		const completed = await update();
		if (completed) isLoading.value = false;
	});

	function currentThreadLengthChanged(newLength: number) {
		room.value!.setCurrentThreadLength(newLength);
	}

	async function update(): Promise<boolean> {
		const currentVersion = ++updateVersion;

		// Set current room early if it already exists (makes header visible sooner)
		if (rooms.roomExists(props.id)) {
			rooms.changeRoom(props.id);
		}

		await rooms.waitForInitialRoomsLoaded();
		if (currentVersion !== updateVersion) return false; // stale update

		hubSettings.hideBar();

		const userIsMember = await pubhubs.isUserRoomMember(user.userId!, props.id);
		if (currentVersion !== updateVersion) return false; // stale update

		// if the user is a member and the room is selected from the roomList in the menu the room possibly has to be joined first: to get all the roomData in the right stores
		if (userIsMember) {
			await rooms.joinRoomListRoom(props.id);
			if (currentVersion !== updateVersion) return false; // stale update
		}

		// change to the current room
		rooms.changeRoom(props.id);

		if (!userIsMember) {
			await rooms.fetchPublicRooms();
			if (currentVersion !== updateVersion) return false; // stale update

			const roomIsSecure = rooms.publicRoomIsSecure(props.id);

			// For secured rooms users first have to authenticate
			if (roomIsSecure) {
				joinSecuredRoom.value = props.id;
				return true;
			}
			// Non-secured rooms can be joined immediately
			try {
				await pubhubs.joinRoom(props.id);
			} catch {
				// Room does not exist or user failed to join room
				router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find_room' } });
			}
		}

		if (!rooms.currentRoom) return true;

		// Initialize syncing of room
		rooms.currentRoom.initTimeline();

		await rooms.fetchPublicRooms(); // Needed for mentions (if not loaded allready)
		return currentVersion === updateVersion;
	}

	async function onScrollToEventId(ev: any) {
		// if there is a threadId and this is a valid id in the room: set the current threadId

		if (ev.threadId && ev.threadId !== ev.eventId) {
			if (!room.value!.findEventById(ev.threadId)) {
				try {
					await room.value!.loadToEvent(ev.threadId);
				} catch (e) {
					LOGGER.error(SMI.ROOM_TIMELINE, `Failed to load event ${ev.thread}`);
				}
			}
			room.value!.setCurrentThreadId(ev.threadId);
		} else {
			room.value!.setCurrentThreadId(undefined);
		}
		room.value!.setCurrentEvent({ eventId: ev.eventId, threadId: undefined });
		scrollToEventId.value = ev.eventId;
	}

	async function stewardCanEdit() {
		// We need to fetch latest public created rooms.
		const currentPublicRooms = await pubhubs.getAllPublicRooms();

		currentRoomToEdit.value = currentPublicRooms.find((room) => room.room_id === props.id);

		// If room is not there then don't show dialog box. Throw an error.
		if (currentRoomToEdit.value?.room_type === RoomType.PH_MESSAGES_RESTRICTED) {
			const secured_room = await rooms.fetchSecuredRoomSteward();
			if (secured_room && secured_room.room_id == props.id) {
				currentRoomToEdit.value = secured_room;
				secured.value = true;
			}
		}
		if (currentRoomToEdit.value) {
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
		return !room.value!.isPrivateRoom() && !room.value!.isGroupRoom() && !room.value!.isAdminContactRoom() && !room.value!.isStewardContactRoom();
	}
</script>
