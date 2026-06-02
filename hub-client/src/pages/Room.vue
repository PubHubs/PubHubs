<template>
	<div class="flex h-full flex-col">
		<template v-if="rooms.currentRoomExists">
			<div
				v-if="isLoading"
				class="flex h-full w-full items-center justify-center"
			>
				<InlineSpinner />
			</div>
			<!-- Shared Header -->
			<div
				v-else
				class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8"
				:class="isMobile ? 'pl-12' : 'pl-8'"
				data-testid="roomheader"
			>
				<!-- Left: Room info -->
				<div
					v-if="rooms.currentRoom"
					class="relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden"
					data-testid="roomtype"
				>
					<Icon
						v-if="!notPrivateRoom()"
						type="caret-left"
						data-testid="back"
						class="cursor-pointer"
						@click="router.push({ name: 'direct-msg' })"
					/>
					<Icon
						v-if="rooms.currentRoom.isForumRoom() && props.topicId"
						type="caret-left"
						data-testid="back"
						class="cursor-pointer"
						@click="router.push({ name: 'room', params: { id: rooms.currentRoomId } })"
					/>
					<Icon
						v-else-if="notPrivateRoom()"
						:type="rooms.currentRoom.isSecuredRoom() ? 'shield' : 'chats-circle'"
					/>
					<div
						v-context-menu="
							!rooms.currentRoom.isDirectMessageRoom()
								? (evt: any) => openMenu(evt, [{ label: t('menu.copy_room_url'), icon: 'copy', onClick: () => copyRoomUrl() }])
								: undefined
						"
						class="group relative"
					>
						<H3 class="text-on-surface flex">
							<TruncatedText class="font-headings font-semibold">
								<PrivateRoomHeader
									v-if="room?.isPrivateRoom()"
									:room="room"
									:members="room.getOtherJoinedAndInvitedMembers()"
								/>
								<GroupRoomHeader
									v-else-if="room?.isGroupRoom()"
									:room="room"
									:members="room.getOtherJoinedAndInvitedMembers()"
								/>
								<AdminContactRoomHeader
									v-else-if="room?.isAdminContactRoom()"
									:room="room"
									:members="room.getOtherJoinedAndInvitedMembers()"
								/>
								<RoomName
									v-else
									:room="rooms.currentRoom"
								/>
							</TruncatedText>
						</H3>
					</div>
				</div>

				<!-- Right: Sidebar controls -->
				<div class="flex items-center gap-2">
					<RoomHeaderButtons>
						<!-- Search -->
						<GlobalBarButton
							type="magnifying-glass"
							:selected="sidebar.activeTab.value === SidebarTab.Search"
							:title="t('others.search_room')"
							@click="sidebar.toggleTab(SidebarTab.Search)"
						/>

						<!-- Room library -->
						<GlobalBarButton
							v-if="settings.isFeatureEnabled(FeatureFlag.roomLibrary)"
							type="folder-simple"
							:selected="sidebar.activeTab.value === SidebarTab.Library"
							@click="sidebar.toggleTab(SidebarTab.Library)"
						/>

						<!-- Video call button -->
						<GlobalBarButton
							v-if="showVideocallButton()"
							type="video"
							:is-start-button="!ongoingCall"
							@click="startOrJoinVideoCall()"
						/>

						<!-- Members -->
						<GlobalBarButton
							v-if="hasRoomMembers"
							type="users"
							:selected="sidebar.activeTab.value === SidebarTab.Members"
							@click="sidebar.toggleTab(SidebarTab.Members)"
						/>

						<!-- Thread tab (shown when a thread is selected) -->
						<GlobalBarButton
							v-if="room?.getCurrentThreadId()"
							type="chat-circle"
							:selected="sidebar.activeTab.value === SidebarTab.Thread"
							@click="sidebar.toggleTab(SidebarTab.Thread)"
						/>

						<!-- Editing icon for steward (but not for administrator) -->
						<GlobalBarButton
							v-if="roles.userHasPermissionForAction(UserAction.StewardPanel, props.id)"
							type="dots-three-vertical"
							@click="stewardCanEdit()"
						/>
					</RoomHeaderButtons>
				</div>
			</div>

			<!-- Content row: Timeline + Sidebar -->
			<div class="flex flex-1 overflow-hidden">
				<div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
					<RoomTimeline
						v-if="room && !room.isForumRoom()"
						:key="props.id"
						:room="room"
						:event-id-to-scroll="scrollToEventId"
						:last-read-event-id="lastReadEventId"
					/>
					<ForumRoomTimeline
						v-if="room && room.isForumRoom()"
						:room="room"
						:topic-id="topicId"
					/>
				</div>

				<!-- Room sidebar -->
				<RoomSidebar
					:active-tab="sidebar.activeTab.value"
					:is-mobile="sidebar.isMobile.value ?? false"
				>
					<RoomLibrary
						v-if="sidebar.activeTab.value === SidebarTab.Library && room"
						:room="room"
					/>
					<RoomThread
						v-if="sidebar.activeTab.value === SidebarTab.Thread && room?.getCurrentThreadId()"
						:room="room"
						:scroll-to-event-id="room.getCurrentEvent()?.eventId"
						@scrolled-to-event-id="room.setCurrentEvent(undefined)"
						@thread-length-changed="currentThreadLengthChanged"
					/>
					<RoomMemberList
						v-if="sidebar.activeTab.value === SidebarTab.Members && room"
						:room="room"
					/>
					<RoomSearch
						v-if="sidebar.activeTab.value === SidebarTab.Search && room"
						:room="room"
						@scroll-to-event-id="onScrollToEventId"
					/>
				</RoomSidebar>
			</div>
		</template>
	</div>
	<!-- Secure room join dialog -->
	<RoomLoginDialog
		v-if="joinSecuredRoom"
		v-model:dialog-open="joinSecuredRoom"
		title="rooms.join_room"
		message="rooms.required_attributes"
		:message-values="[]"
		:secured="true"
	/>
</template>

<script setup lang="ts">
	// Packages
	import { KnownMembership } from 'matrix-js-sdk';
	import { capitalize, computed, onMounted, ref, watch, watchEffect } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import AdminContactRoomHeader from '@hub-client/components/rooms/AdminContactRoomHeader.vue';
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
	import ForumRoomTimeline from '@hub-client/components/rooms/forum/ForumRoomTimeline.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import InlineSpinner from '@hub-client/components/ui/InlineSpinner.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useModerationBase } from '@hub-client/composables/moderation/base.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';
	import { useClipboard } from '@hub-client/composables/useClipboard';
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { createLogger } from '@hub-client/logic/logging/Logger';
	import { delay } from '@hub-client/logic/utils/common';

	// Models
	import { QueryParameterKey } from '@hub-client/models/constants';
	import { UserAction } from '@hub-client/models/users/TUser';

	import { DialogOk, useDialog } from '@hub-client/stores/dialog';
	// Stores
	import { useHubSettings } from '@hub-client/stores/hub-settings';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { FeatureFlag, useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';
	import useVideoCall from '@hub-client/stores/videoCall';

	// Passed by the router
	const props = defineProps({
		id: { type: String, required: true },
		topicId: { type: String, default: undefined },
	});

	const logger = createLogger('Room');

	const { t } = useI18n();
	const route = useRoute();
	const rooms = useRooms();
	const user = useUser();
	const dialogStore = useDialog();
	const roles = useRoles();
	const router = useRouter();
	const hubSettings = useHubSettings();
	const videoCall = useVideoCall();
	const { copyCurrentRoomUrl: copyRoomUrl } = useClipboard();
	const { openMenu } = useContextMenu();
	const sidebar = useSidebar();
	const settings = useSettings();
	const isMobile = computed(() => settings.isMobileState);

	const pubhubs = usePubhubsStore();
	const { membershipEvents } = useModerationBase();

	const ongoingCall = computed(() => room.value!.isOngoingCall());
	const joinSecuredRoom = ref<string | null>(null);
	const scrollToEventId = ref<string>();
	const isLoading = ref(!rooms.roomExists(props.id));
	let updateVersion = 0; // Used to cancel stale update() calls

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

	// Clear thread and search when sidebar is closed
	watch(
		() => sidebar.isOpen.value,
		(isOpen) => {
			// Only clear thread when transitioning from open to closed
			if (isOpen === false && room.value) {
				room.value.setCurrentThreadId(undefined);
				sidebar.clearSearchState();
			}
		},
	);

	// Clear search when switching away from Search or Thread tabs
	watch(
		() => sidebar.activeTab.value,
		(tab) => {
			if (tab !== SidebarTab.Search && tab !== SidebarTab.Thread) {
				sidebar.clearSearchState();
			}
		},
	);

	watch(route, async () => {
		// On mobile, always close sidebar when switching rooms
		// On desktop, only close if a thread is open
		if (sidebar.isMobile.value || sidebar.activeTab.value === SidebarTab.Thread) {
			sidebar.closeInstantly();
		}

		// Check for eventId in query param on route change
		const eventIdFromQuery = route.query[QueryParameterKey.EventId] as string | undefined;
		if (eventIdFromQuery) {
			scrollToEventId.value = eventIdFromQuery;
		}
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

	// Close sidebar instantly before leaving this page
	onBeforeRouteLeave(() => {
		sidebar.closeInstantly();
	});

	function currentThreadLengthChanged(newLength: number) {
		room.value?.setCurrentThreadLength(newLength);
	}

	async function update(): Promise<boolean> {
		const currentVersion = ++updateVersion;

		// Fast path: room already loaded, just switch to it
		if (rooms.roomExists(props.id)) {
			rooms.changeRoom(props.id);
			hubSettings.hideBar();
			rooms.currentRoom?.initTimeline();
			return currentVersion === updateVersion;
		}

		// Slow path: first visit, need to join and initialize
		isLoading.value = true;

		await rooms.waitForInitialRoomsLoaded();
		if (currentVersion !== updateVersion) return false;

		hubSettings.hideBar();

		const userIsMember = user.userId ? await pubhubs.isUserRoomMember(user.userId, props.id) : false;
		if (currentVersion !== updateVersion) return false;

		if (userIsMember) {
			await rooms.joinRoomListRoom(props.id);
			if (currentVersion !== updateVersion) return false;
		}

		rooms.changeRoom(props.id);

		if (!userIsMember) {
			await rooms.fetchPublicRooms();
			if (currentVersion !== updateVersion) return false;

			const roomIsSecure = rooms.publicRoomIsSecure(props.id);

			if (roomIsSecure) {
				joinSecuredRoom.value = props.id;
				return true;
			}
			try {
				await pubhubs.joinRoom(props.id);
			} catch {
				router.push({ name: 'error-page', query: { errorKey: 'errors.cant_find_room' } });
			}
		}

		if (!rooms.currentRoom) return true;

		rooms.currentRoom.initTimeline();

		await rooms.fetchPublicRooms();
		return currentVersion === updateVersion;
	}

	async function onScrollToEventId(ev: { eventId: string; threadId?: string }) {
		if (!room.value) return;
		// if there is a threadId and this is a valid id in the room: set the current threadId

		if (ev.threadId && ev.threadId !== ev.eventId) {
			if (!room.value.findEventById(ev.threadId)) {
				try {
					await room.value.loadToEvent({ eventId: ev.threadId });
				} catch {
					logger.error(`Failed to load event ${ev.threadId}`);
				}
			}
			room.value.setCurrentThreadId(ev.threadId);
			sidebar.openTab(SidebarTab.Thread);
		} else {
			room.value.setCurrentThreadId(undefined);
		}
		room.value.setCurrentEvent({ eventId: ev.eventId, threadId: undefined });
		scrollToEventId.value = ev.eventId;
	}

	async function stewardCanEdit() {
		// We need to fetch latest public created rooms.
		const currentPublicRooms = await pubhubs.getAllPublicRooms();

		const roomToEdit = currentPublicRooms.find((room) => room.room_id === props.id);

		// If room is not there then don't show dialog box. Throw an error.
		if (roomToEdit) {
			router.push({ name: 'editroom', params: { id: props.id } });
		} else {
			router.push({
				name: 'error-page',
				query: { errorKey: 'errors.cant_find_room' },
			});
		}
	}
	function notPrivateRoom() {
		if (!room.value) return true;
		return !room.value.isPrivateRoom() && !room.value.isGroupRoom() && !room.value.isAdminContactRoom() && !room.value.isStewardContactRoom();
	}

	async function startOrJoinVideoCall() {
		let connected = false;
		if (room.value!.isOngoingCall()) {
			connected = await videoCall.joinCall();
			if (!connected) {
				connected = await videoCall.startCall();
			}
		} else {
			connected = await videoCall.startCall();
		}
		if (!connected) return;
		await router.push({ name: 'videocall' });
	}

	function showVideocallButton(): boolean {
		return settings.isFeatureEnabled(FeatureFlag.videocalls) && (room.value!.isSecuredRoom() || room.value!.isPrivateRoom());
	}

	const handleKick = (roomId: string, reason?: string) => {
		const message = reason
			? `${capitalize(t('moderation.removed_from_room'))}\n\n${capitalize(t('moderation.kick_reason'))}: ${reason}`
			: capitalize(t('moderation.removed_from_room'));
		dialogStore.yesno(message);

		const handleOk = async () => {
			cleanup();
			await pubhubs.joinRoom(roomId);
			const maxAttempts = 7;
			for (let attempt = 0; attempt < maxAttempts; attempt++) {
				const hasJoinEvent = membershipEvents.value.some(
					(event) => event.content.membership === KnownMembership.Join && event.state_key === user.userId,
				);
				if (hasJoinEvent) {
					router.push({ name: 'room', params: { id: roomId } });
					break;
				}
				await delay(attempt);
			}
		};

		const cleanup = () => {
			dialogStore.removeCallback(DialogOk);
		};

		dialogStore.addCallback(DialogOk, handleOk);
	};

	watchEffect(async () => {
		const currentRoom = rooms.currentRoom;
		if (!currentRoom) return;

		// Check if user was banned (red card)
		const hasBanEvent = membershipEvents.value.some(
			(event) => event.content.membership === KnownMembership.Ban && event.state_key === user.userId && event.sender !== event.state_key,
		);

		// Check if user was kicked (removed from room without ban)
		const kickEvent = membershipEvents.value.find(
			(event) => event.content.membership === KnownMembership.Leave && event.state_key === user.userId && event.sender !== event.state_key,
		);

		if (hasBanEvent) {
			// Red card - user is banned, redirect to error page
			router.push({ name: 'error-page', query: { errorKey: 'moderation.red_card_info' } });
		} else if (kickEvent) {
			// Regular kick (remove from room) - show dialog to rejoin with reason
			handleKick(currentRoom.roomId, kickEvent.content.reason);
			router.push({ name: 'home' });
		}
	});
</script>
