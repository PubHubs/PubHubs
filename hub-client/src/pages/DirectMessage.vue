<template>
	<div class="flex h-full flex-col">
		<!-- Shared Header -->
		<div
			class="border-on-surface-disabled/25 flex h-1000 shrink-0 items-center justify-between gap-200 border-b-2"
			:class="isMobile ? 'pl-600' : 'pl-400'"
		>
			<!-- Left: DM title (on mobile, show conversation name when sidebar is open) -->
			<div class="flex min-w-0 flex-1 items-center gap-150 overflow-x-hidden">
				<Icon type="chat-circle-text" />
				<H3 class="text-on-surface w-full min-w-0">
					<TruncatedText class="font-headings text-h3 font-semibold">
						<span v-if="isMobile && sidebar.isOpen.value && sidebar.selectedDMRoom.value">
							{{ mobileConversationTitle }}
						</span>
						<span v-else>{{ t('menu.directmsg') }}</span>
					</TruncatedText>
				</H3>
				<TruncatedText class="hidden md:inline" />
			</div>

			<!-- Right: Buttons (hidden on mobile when sidebar is open) -->
			<div
				v-if="!isMobile || !sidebar.isOpen.value"
				class="flex items-center gap-100"
			>
				<!-- Search button (desktop only, when room is selected) -->
				<GlobalBarButton
					v-if="!isMobile && selectedRoom"
					type="magnifying-glass"
					:selected="sidebar.activeTab.value === SidebarTab.Search"
					@click="sidebar.toggleTab(SidebarTab.Search)"
				/>

				<!-- Members button (desktop only, for group DMs) -->
				<GlobalBarButton
					v-if="!isMobile && isGroupDM"
					type="users"
					:selected="sidebar.activeTab.value === SidebarTab.Members"
					@click="sidebar.toggleTab(SidebarTab.Members)"
				/>
			</div>
		</div>

		<!-- Content row: Message list + DM room (desktop) or sidebar (mobile) -->
		<div class="flex flex-1 overflow-hidden">
			<!-- Conversation list -->
			<div
				class="relative flex h-full flex-col overflow-y-auto p-150 md:p-200"
				:class="isMobile ? 'w-full' : 'w-[360px] shrink-0'"
				:data-loaded="!dmLoading || undefined"
			>
				<div
					v-if="dmLoading && sortedPrivateRooms.length === 0"
					class="@container flex w-full flex-col gap-200"
				>
					<div
						v-for="n in 3"
						:key="n"
						class="bg-surface-base w-full animate-pulse rounded-xl p-200"
					>
						<div class="flex gap-150">
							<div class="bg-surface-base h-600 w-600 shrink-0 rounded-full" />
							<div class="gap-050 flex min-w-0 flex-1 flex-col">
								<div class="bg-surface-base h-250 w-2/3 rounded" />
								<div class="bg-surface-base hidden h-[18px] w-1/3 rounded @xs:block" />
								<div class="bg-surface-base h-250 w-full rounded" />
							</div>
						</div>
					</div>
				</div>
				<button
					v-else-if="sortedPrivateRooms.length === 0"
					class="bg-surface-base hover:bg-surface-elevated border-surface-elevated rounded-base h-1000 w-full cursor-pointer border-3 p-200 text-left"
					@click="sidebar.toggleTab(SidebarTab.NewDM)"
				>
					<div class="flex items-center gap-100">
						<div class="flex h-10 w-10 shrink-0 items-center justify-center">
							<Icon
								type="plus"
								size="sm"
							/>
						</div>
						<p class="font-bold">{{ t('others.new_message') }}</p>
					</div>
				</button>
				<div
					class="flex w-full flex-col gap-200 transition-all duration-300 ease-in-out"
					role="list"
					data-testid="conversations"
				>
					<MessagePreview
						v-for="entry in sortedPrivateRooms"
						:key="entry.room.roomId"
						v-context-menu="
							(evt: any) =>
								openMenu(
									evt,
									[
										{
											label: t('menu.leave_conversation'),
											icon: 'sign-out',
											variant: ContextVariant.delicate,
											onClick: () => leaveConversation(entry.room),
										},
									],
									entry.room.roomId,
								)
						"
						:room="entry.room"
						:unread-state="entry.unreadState"
						:is-mobile="isMobile"
						:active="selectedRoom?.roomId === entry.room.roomId"
						class="hover:cursor-pointer"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === entry.room.roomId && 'bg-surface-base!'"
						role="listitem"
						@click="openDMRoom(entry.room)"
					/>
				</div>

				<FloatingActionButton
					class="absolute right-200 bottom-200"
					:label="t('others.new_message')"
					icon="plus"
					@click="sidebar.toggleTab(SidebarTab.NewDM)"
				/>
			</div>

			<!-- Desktop: DM room shown directly (not in sidebar) -->
			<div
				v-if="!isMobile && selectedRoom"
				class="border-on-surface-disabled/25 flex min-w-0 flex-1 border-l-2"
			>
				<DirectMessageRoom
					:key="selectedRoom.roomId"
					:room="selectedRoom"
					:event-id-to-scroll="scrollToEventId"
					class="min-w-0 flex-1"
				/>

				<!-- Desktop: Search Sidebar (only when room selected) -->
				<RoomSidebar
					v-if="sidebar.activeTab.value === SidebarTab.Search"
					:active-tab="SidebarTab.Search"
					:is-mobile="false"
				>
					<RoomSearch
						:room="selectedRoom"
						@scroll-to-event-id="onScrollToEventId"
					/>
				</RoomSidebar>

				<!-- Desktop: Members Sidebar (only for group DMs) -->
				<RoomSidebar
					v-if="sidebar.activeTab.value === SidebarTab.Members && isGroupDM"
					:active-tab="SidebarTab.Members"
					:is-mobile="false"
				>
					<RoomMemberList
						:room="selectedRoom"
						:disable-d-m="true"
					/>
				</RoomSidebar>
			</div>

			<!-- Desktop: Empty state when no room selected -->
			<div
				v-if="!isMobile && !selectedRoom && sortedPrivateRooms.length > 0"
				class="border-on-surface-disabled/25 text-on-surface-dim flex flex-1 items-center justify-center border-l-2"
			>
				{{ t('others.select_conversation') }}
			</div>

			<!-- Desktop: Placeholder when no conversations exist yet -->
			<div
				v-if="!isMobile && !dmLoading && sortedPrivateRooms.length === 0"
				class="border-on-surface-disabled/25 text-on-surface-dim flex flex-1 items-center justify-center border-l-2"
			>
				{{ t('others.start_new_conversation') }}
			</div>

			<!-- Desktop: NewDM Sidebar (can appear without room selected) -->
			<RoomSidebar
				v-if="!isMobile && sidebar.activeTab.value === SidebarTab.NewDM"
				:active-tab="SidebarTab.NewDM"
				:is-mobile="false"
			>
				<NewConversationPanel
					:is-mobile="false"
					@close="sidebar.close()"
				/>
			</RoomSidebar>

			<!-- Mobile: DM room in sidebar -->
			<RoomSidebar
				v-if="isMobile"
				:active-tab="sidebar.activeTab.value"
				:is-mobile="true"
			>
				<DirectMessageRoom
					v-if="sidebar.activeTab.value === SidebarTab.DirectMessage && sidebar.selectedDMRoom.value"
					:key="sidebar.selectedDMRoom.value.roomId"
					:room="sidebar.selectedDMRoom.value"
				/>
				<NewConversationPanel
					v-if="sidebar.activeTab.value === SidebarTab.NewDM"
					:is-mobile="true"
					@close="sidebar.close()"
				/>
			</RoomSidebar>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventTimeline, EventType } from 'matrix-js-sdk';
	import { computed, onMounted, ref, shallowRef, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router';

	import FloatingActionButton from '@hub-client/components/elements/FloatingActionButton.vue';
	// Components
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import DirectMessageRoom from '@hub-client/components/rooms/DirectMessageRoom.vue';
	import NewConversationPanel from '@hub-client/components/rooms/NewConversationPanel.vue';
	import RoomMemberList from '@hub-client/components/rooms/RoomMemberList.vue';
	import RoomSearch from '@hub-client/components/rooms/RoomSearch.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import GlobalBarButton from '@hub-client/components/ui/GlobalbarButton.vue';
	import MessagePreview from '@hub-client/components/ui/MessagePreview.vue';

	// New design
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	// Composable
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { getOtherRoomMembers } from '@hub-client/logic/utils/roomUtils';

	import { ContextVariant } from '@hub-client/models/components/contextMenu.models';
	// Models
	import { RoomType, type UnreadState } from '@hub-client/models/rooms/TBaseRoom';

	import { useContextMenuStore } from '@hub-client/stores/contextMenu.store';
	// Store
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { type Room, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();
	const dialog = useDialog();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const rooms = useRooms();
	const userStore = useUser();
	const { t } = useI18n();
	const sidebar = useSidebar();

	const router = useRouter();
	const route = useRoute();
	const isMobile = computed(() => settings.isMobileState);

	const selectedRoom = shallowRef<Room | null>(null);
	const scrollToEventId = ref<string | undefined>(undefined);

	const dmLoading = ref(true);

	const isGroupDM = computed(() => {
		return selectedRoom.value?.getType() === RoomType.PH_MESSAGES_GROUP;
	});

	type PrivateRoomEntry = { room: Room; unreadState: UnreadState };

	const sortedPrivateRooms = computed<PrivateRoomEntry[]>(() => {
		return rooms.loadedPrivateRooms
			.filter((r) => rooms.rooms[r.roomId])
			.map((r) => ({ room: rooms.rooms[r.roomId] as Room, unreadState: r.unreadState }))
			.sort((a, b) => {
				const selectedRoomId = selectedRoom.value?.roomId ?? sidebar.selectedDMRoom.value?.roomId;
				const aIsNewSelected = a.room.roomId === selectedRoomId && !a.room.hasMessages();
				const bIsNewSelected = b.room.roomId === selectedRoomId && !b.room.hasMessages();
				if (aIsNewSelected && !bIsNewSelected) return -1;
				if (!aIsNewSelected && bIsNewSelected) return 1;
				return lastEventTimeStamp(b.room) - lastEventTimeStamp(a.room);
			});
	});

	const mobileConversationTitle = computed(() => {
		const room = sidebar.selectedDMRoom.value;
		if (!room) return '';

		const roomType = room.getType();
		if (roomType === RoomType.PH_MESSAGES_GROUP) return room.name;
		if (roomType === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');

		const otherMembers = getOtherRoomMembers(room, userStore.userId);
		if (otherMembers.length > 0) {
			return userStore.userDisplayName(otherMembers[0]) ?? t('menu.directmsg');
		}

		// Fallback for members not fully joined yet
		const notInvitedMemberIds = room.notInvitedMembersIdsOfPrivateRoom();
		const otherId = notInvitedMemberIds.find((id) => id !== userStore.userId);
		if (otherId) {
			const member = room.getMember(otherId);
			return member?.rawDisplayName ?? t('menu.directmsg');
		}

		return t('menu.directmsg');
	});

	// Uses sidebar state, falling back to lastDMRoomId or route query (which survives closeInstantly)
	function findTargetRoom(entries: PrivateRoomEntry[]): Room | undefined {
		if (sidebar.selectedDMRoom.value) return sidebar.selectedDMRoom.value;
		if (sidebar.lastDMRoomId.value) return entries.find((e) => e.room.roomId === sidebar.lastDMRoomId.value)?.room;
		const roomIdFromQuery = route.query.roomId as string | undefined;
		if (roomIdFromQuery) return rooms.rooms[roomIdFromQuery] as Room | undefined;
		return undefined;
	}

	onMounted(async () => {
		await loadPrivateRooms();

		const target = findTargetRoom(sortedPrivateRooms.value);

		if (isMobile.value) {
			if (target) sidebar.openDMRoom(target);
		} else if (target) {
			openDMRoom(target);
		} else if (sortedPrivateRooms.value.length > 0) {
			openDMRoom(sortedPrivateRooms.value[0].room);
		}

		if (route.query.roomId) {
			router.replace({ query: {} });
		}
	});

	// Sync desktop selectedRoom when a new DM is opened via sidebar
	watch(
		() => sidebar.selectedDMRoom.value,
		(newRoom) => {
			if (!newRoom || isMobile.value) return;
			selectedRoom.value = newRoom;
		},
	);

	onBeforeRouteLeave((to) => {
		if (to.name === 'room') {
			sidebar.closeInstantly();
		}
	});

	async function loadPrivateRooms() {
		try {
			await rooms.waitForInitialRoomsLoaded();
			const roomsList = rooms.loadedPrivateRooms;
			for (const room of roomsList) {
				await rooms.joinRoomListRoom(room.roomId);
			}
			const roomIdFromQuery = route.query.roomId as string | undefined;
			if (roomIdFromQuery && !roomsList.find((r) => r.roomId === roomIdFromQuery)) {
				await rooms.joinRoomListRoom(roomIdFromQuery);
			}
		} finally {
			dmLoading.value = false;
		}
	}

	function lastEventTimeStamp(room: Room): number {
		const messageEvents = room.getLiveTimelineEvents().filter((event) => event.getType() === EventType.RoomMessage);

		if (messageEvents.length === 0) {
			// Fall back to room creation date so empty rooms correctly order
			const timeline = room.matrixRoom.getLiveTimeline();
			const createEvent = timeline?.getState(EventTimeline.FORWARDS)?.getStateEvents(EventType.RoomCreate, '');
			return createEvent?.event?.origin_server_ts ?? 0;
		}

		messageEvents.sort((a, b) => b.localTimestamp - a.localTimestamp);
		return messageEvents[0].localTimestamp;
	}

	function openDMRoom(room: Room) {
		sidebar.openDMRoom(room);
		if (!isMobile.value) {
			selectedRoom.value = room;
		}
	}

	async function leaveConversation(room: Room) {
		if (await dialog.okcancel(t('rooms.leave_dm_sure'))) {
			await pubhubs.leaveDMRoom(room);
			if (selectedRoom.value?.roomId === room.roomId) {
				selectedRoom.value = null;
			}
			sidebar.close();
		}
	}

	function onScrollToEventId(ev: { eventId: string; threadId?: string }) {
		scrollToEventId.value = ev.eventId;
	}
</script>
