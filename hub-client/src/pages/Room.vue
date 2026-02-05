<template>
	<div class="flex h-full flex-col">
		<template v-if="rooms.currentRoomExists">
			<!-- Shared Header -->
			<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8" :class="isMobile ? 'pl-12' : 'pl-8'" data-testid="roomheader">
				<!-- Left: Room info -->
				<div v-if="rooms.currentRoom" class="relative flex w-fit items-center gap-3" data-testid="roomtype">
					<Icon v-if="!notPrivateRoom()" type="caret-left" data-testid="back" class="cursor-pointer" @click="router.push({ name: 'direct-msg' })" />
					<Icon v-else-if="notPrivateRoom()" :type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'chats-circle'" />
					<div class="group hover:mt-025 relative hover:cursor-pointer" @click="copyRoomUrl" :title="t('menu.copy_room_url')">
						<div class="flex flex-col group-hover:border-b-2 group-hover:border-dotted">
							<H3 class="text-on-surface flex">
								<TruncatedText class="font-headings font-semibold">
									<PrivateRoomHeader v-if="room!.isPrivateRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
									<GroupRoomHeader v-else-if="room!.isGroupRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
									<AdminContactRoomHeader v-else-if="room!.isAdminContactRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
									<StewardContactRoomHeader v-else-if="room!.isStewardContactRoom()" :room="room!" :members="room!.getOtherJoinedAndInvitedMembers()" />
									<RoomName v-else :room="rooms.currentRoom" />
								</TruncatedText>
							</H3>
							<TruncatedText class="hidden md:inline"> </TruncatedText>
						</div>
						<Icon type="copy" size="sm" class="text-on-surface-dim group-hover:text-on-surface absolute top-0 right-0 -mr-2" />
					</div>
				</div>

				<!-- Right: Sidebar controls -->
				<div class="flex items-center gap-2">
					<!-- Close button -->
					<button v-if="sidebar.isOpen.value" class="hover:bg-surface-variant rounded-md p-2 transition-colors hover:cursor-pointer" :aria-label="t('global.close')" @click="sidebar.close()">
						<Icon type="arrow-right" size="base" />
					</button>
					<RoomHeaderButtons>
						<GlobalBarButton v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)" type="folder-simple" :selected="sidebar.activeTab.value === SidebarTab.Library" @click="sidebar.toggleTab(SidebarTab.Library)" />
						<GlobalBarButton type="users" :selected="sidebar.activeTab.value === SidebarTab.Members" @click="sidebar.toggleTab(SidebarTab.Members)" />
						<GlobalBarButton type="magnifying-glass" :selected="sidebar.activeTab.value === SidebarTab.Search" @click="sidebar.toggleTab(SidebarTab.Search)" />
						<!-- Thread tab indicator (shown when active) -->
						<GlobalBarButton v-if="sidebar.activeTab.value === SidebarTab.Thread" type="chat-circle" :selected="true" />
						<!--Only show Editing icon for steward but not for administrator-->
						<GlobalBarButton v-if="hasRoomPermission(room!.getUserPowerLevel(user.userId), actions.StewardPanel)" type="dots-three-vertical" @click="stewardCanEdit()" />
						<!--Except for moderator everyone should talk to room moderator-->
						<GlobalBarButton v-if="hasRoomPermission(room!.getUserPowerLevel(user.userId), actions.MessageSteward) && room!.getRoomStewards().length > 0" type="chat-circle" @click="messageRoomSteward()" />
					</RoomHeaderButtons>
				</div>
			</div>

			<!-- Content row: Timeline + Sidebar -->
			<div class="flex flex-1 overflow-hidden">
				<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
					<RoomTimeline v-if="room" :key="props.id" ref="roomTimeLineComponent" :room="room" :event-id-to-scroll="scrollToEventId" :last-read-event-id="getLastReadMessage(props.id) ?? undefined" />
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
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useClipboard } from '@hub-client/composables/useClipboard';
	import { useLastReadMessages } from '@hub-client/composables/useLastReadMessages';
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
	const roomTimeLineComponent = ref<InstanceType<typeof RoomTimeline> | null>(null);
	const scrollToEventId = ref<string>();
	const { getLastReadMessage, setLastReadMessage } = useLastReadMessages();

	// Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
	});

	// This guarantees that room has a value, so in the template we can safely use room!
	const room = computed(() => {
		let r = rooms.rooms[props.id];
		if (!r) {
			// eslint-disable-next-line
			router.push({
				name: 'error-page',
				query: { errorKey: 'errors.cant_find_room' },
			});
			return undefined;
		}
		// The name of the room will be synced later, start with an empty name
		if (r.name === props.id) {
			r.name = '';
		}
		return r;
	});

	onMounted(() => {
		// Ensure sidebar is closed instantly when entering a room page
		sidebar.closeInstantly();
		update();
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
	});

	// Close sidebar instantly before leaving this page
	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	// Close sidebar instantly before leaving this page
	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	watch(
		route,
		() => {
			// Check for eventId in query param on route change
			const eventIdFromQuery = route.query[QueryParameterKey.EventId] as string | undefined;
			if (eventIdFromQuery) {
				scrollToEventId.value = eventIdFromQuery;
			}

			if (rooms.currentRoom) {
				// Save last visible (read) event to localStorage
				const lastEventId = rooms.currentRoom.getLastVisibleEventId();
				if (lastEventId) {
					const event = rooms.currentRoom.findEventById(lastEventId);
					if (event) {
						// Use the message's timestamp; marker can only advance to newer messages
						const messageTimestamp = event.localTimestamp || event.getTs();
						if (messageTimestamp) {
							setLastReadMessage(rooms.currentRoom.roomId, lastEventId, messageTimestamp);
						}
					}
				}
				rooms.currentRoom.setCurrentThreadId(undefined);
				rooms.currentRoom.setCurrentEvent(undefined);
			}
			update();
		},
		{ immediate: true },
	);

	// Auto-activate Thread tab when a thread is opened
	watch(
		() => room.value?.getCurrentThreadId(),
		(threadId) => {
			if (threadId) {
				sidebar.openTab(SidebarTab.Thread);
			} else if (sidebar.activeTab.value === SidebarTab.Thread) {
				sidebar.close();
			}
		},
	);

	function currentThreadLengthChanged(newLength: number) {
		room.value!.setCurrentThreadLength(newLength);
	}

	async function update() {
		// Set current room early if it already exists (makes header visible sooner)
		if (rooms.roomExists(props.id)) {
			rooms.changeRoom(props.id);
		}

		await rooms.waitForInitialRoomsLoaded();

		hubSettings.hideBar();
		rooms.changeRoom(props.id);

		const userIsMember = await pubhubs.isUserRoomMember(user.userId!, props.id);
		if (!userIsMember) {
			let promise = null;

			await rooms.fetchPublicRooms();
			const roomIsSecure = rooms.publicRoomIsSecure(props.id);

			// For secured rooms users first have to authenticate
			if (roomIsSecure) {
				joinSecuredRoom.value = props.id;
				return;
			}
			// Non-secured rooms can be joined immediately
			else {
				promise = pubhubs.joinRoom(props.id);
			}
			// Need this extra check
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

		await rooms.fetchPublicRooms(); // Needed for mentions (if not loaded allready)
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

	async function messageRoomSteward() {
		const members = room.value!.getRoomStewards();
		await rooms.createStewardRoomOrModify(props.id, members);
	}
</script>
