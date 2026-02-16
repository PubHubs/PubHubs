<template>
	<div class="flex h-full flex-col">
		<!-- Shared Header -->
		<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8" :class="isMobile ? 'pl-12' : 'pl-8'">
			<!-- Left: DM title (on mobile, show conversation name when sidebar is open) -->
			<div class="flex w-fit items-center gap-3 overflow-hidden">
				<Icon type="chat-circle-text" :class="isMobile && 'hidden'" />
				<H3 class="text-on-surface flex" :class="isMobile ? 'gap-2' : 'gap-4'">
					<TruncatedText class="font-headings text-h3 font-semibold">
						<H3 v-if="isMobile && sidebar.isOpen.value && sidebar.selectedDMRoom.value">
							{{ mobileConversationTitle }}
						</H3>
						<H3 v-else>{{ t('menu.directmsg') }}</H3>
					</TruncatedText>
				</H3>
				<TruncatedText class="hidden md:inline" />
			</div>

			<!-- Right: Buttons (hidden on mobile when sidebar is open) -->
			<div v-if="!isMobile || !sidebar.isOpen.value" class="flex items-center gap-2">
				<!-- Admin contact button (hidden once room exists) -->
				<div v-if="!user.isAdmin && !adminRoomExists" class="relative">
					<GlobalBarButton type="lifebuoy" @click="handleAdminContact()" />
				</div>

				<div v-if="!user.isAdmin && !adminRoomExists" class="bg-on-surface-disabled mx-1 h-6 w-px"></div>

				<!-- Search button (desktop only, when room is selected) -->
				<GlobalBarButton v-if="!isMobile && selectedRoom" type="magnifying-glass" :selected="sidebar.activeTab.value === SidebarTab.Search" @click="sidebar.toggleTab(SidebarTab.Search)" />

				<!-- Members button (desktop only, for group DMs) -->
				<GlobalBarButton v-if="!isMobile && isGroupDM" type="users" :selected="sidebar.activeTab.value === SidebarTab.Members" @click="sidebar.toggleTab(SidebarTab.Members)" />

				<!-- New message button -->
				<GlobalBarButton type="plus" :selected="sidebar.activeTab.value === SidebarTab.NewDM" @click="sidebar.toggleTab(SidebarTab.NewDM)" />
			</div>
		</div>

		<!-- Content row: Message list + DM room (desktop) or sidebar (mobile) -->
		<div class="flex flex-1 overflow-hidden">
			<!-- Conversation list -->
			<div class="flex h-full flex-col overflow-y-auto p-3 md:p-4" :class="isMobile ? 'w-full' : 'w-[412px] shrink-0'">
				<span v-if="privateRooms?.length === 0" class="mx-auto shrink-0">
					{{ t('others.no_private_message') }}
				</span>
				<div class="flex w-full flex-col gap-4 transition-all duration-300 ease-in-out" role="list" data-testid="conversations">
					<MessagePreview
						v-for="room in sortedPrivateRooms"
						:key="room.roomId"
						:room="room"
						:isMobile="isMobile"
						:active="selectedRoom?.roomId === room.roomId"
						class="hover:cursor-pointer"
						:class="contextMenuStore.isOpen && contextMenuStore.currentTargetId === room.roomId && 'bg-surface-low!'"
						role="listitem"
						@click="openDMRoom(room)"
					/>
				</div>
			</div>

			<!-- Desktop: DM room shown directly (not in sidebar) -->
			<div v-if="!isMobile && selectedRoom" class="border-on-surface-disabled flex min-w-0 flex-1 border-l">
				<DirectMessageRoom :room="selectedRoom" :event-id-to-scroll="scrollToEventId" class="min-w-0 flex-1" />

				<!-- Desktop: Search Sidebar (only when room selected) -->
				<RoomSidebar v-if="sidebar.activeTab.value === SidebarTab.Search" :active-tab="SidebarTab.Search" :is-mobile="false">
					<RoomSearch :room="selectedRoom" @scroll-to-event-id="onScrollToEventId" />
				</RoomSidebar>

				<!-- Desktop: Members Sidebar (only for group DMs) -->
				<RoomSidebar v-if="sidebar.activeTab.value === SidebarTab.Members && isGroupDM" :active-tab="SidebarTab.Members" :is-mobile="false">
					<RoomMemberList :room="selectedRoom" :disable-d-m="true" />
				</RoomSidebar>
			</div>

			<!-- Desktop: Empty state when no room selected -->
			<div v-if="!isMobile && !selectedRoom && sortedPrivateRooms.length > 0" class="border-on-surface-disabled text-on-surface-dim flex flex-1 items-center justify-center border-l">
				{{ t('others.select_conversation') }}
			</div>

			<!-- Desktop: Placeholder when no conversations exist yet -->
			<div v-if="!isMobile && sortedPrivateRooms.length === 0" class="border-on-surface-disabled text-on-surface-dim flex flex-1 items-center justify-center border-l">
				{{ t('others.start_new_conversation') }}
			</div>

			<!-- Desktop: NewDM Sidebar (can appear without room selected) -->
			<RoomSidebar v-if="!isMobile && sidebar.activeTab.value === SidebarTab.NewDM" :active-tab="SidebarTab.NewDM" :is-mobile="false">
				<NewConversationPanel :isMobile="false" @close="sidebar.close()" />
			</RoomSidebar>

			<!-- Mobile: DM room in sidebar -->
			<RoomSidebar v-if="isMobile" :active-tab="sidebar.activeTab.value" :is-mobile="true">
				<DirectMessageRoom v-if="sidebar.activeTab.value === SidebarTab.DirectMessage && sidebar.selectedDMRoom.value" :room="sidebar.selectedDMRoom.value" />
				<NewConversationPanel v-if="sidebar.activeTab.value === SidebarTab.NewDM" :isMobile="true" @close="sidebar.close()" />
			</RoomSidebar>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, NotificationCountType } from 'matrix-js-sdk';
	import { computed, onMounted, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';
	import { onBeforeRouteLeave } from 'vue-router';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
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

	// Composable
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Models
	import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Store
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { Room, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const contextMenuStore = useContextMenuStore();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const { t } = useI18n();
	const dialog = useDialog();
	const sidebar = useSidebar();

	const isMobile = computed(() => settings.isMobileState);

	const selectedRoom = ref<Room | null>(null);
	const scrollToEventId = ref<string | undefined>(undefined);

	const privateRooms = computed(() => rooms.loadedPrivateRooms);

	const newAdminMsgCount = computed(() => {
		if (user.isAdmin) return;
		const adminContactRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		return adminContactRoom?.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
	});

	const adminRoomExists = computed(() => rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).length > 0);

	const isAdminRoomVisible = computed(() => {
		return rooms.loadedPrivateRooms.some((r) => r.getType() === RoomType.PH_MESSAGE_ADMIN_CONTACT);
	});

	const isGroupDM = computed(() => {
		return selectedRoom.value?.getType() === RoomType.PH_MESSAGES_GROUP;
	});

	const sortedPrivateRooms = computed(() => {
		return [...privateRooms.value].sort((r1, r2) => {
			return lastEventTimeStamp(r2) - lastEventTimeStamp(r1);
		});
	});

	const mobileConversationTitle = computed(() => {
		const room = sidebar.selectedDMRoom.value;
		if (!room) return '';

		const roomType = room.getType();
		if (roomType === RoomType.PH_MESSAGES_GROUP) return room.name;
		if (roomType === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');

		const otherMembers = room.getOtherJoinedMembers();
		if (otherMembers.length > 0) {
			return otherMembers[0]?.rawDisplayName ?? t('menu.directmsg');
		}

		// Fallback for members not fully joined yet
		const notInvitedMemberIds = room.notInvitedMembersIdsOfPrivateRoom();
		if (notInvitedMemberIds.length > 0) {
			const member = room.getMember(notInvitedMemberIds[0]);
			return member?.rawDisplayName ?? t('menu.directmsg');
		}

		return t('menu.directmsg');
	});

	// Uses sidebar state, falling back to lastDMRoomId (which survives closeInstantly)
	function findTargetRoom(roomList: Room[]): Room | undefined {
		if (sidebar.selectedDMRoom.value) return sidebar.selectedDMRoom.value;
		if (sidebar.lastDMRoomId.value) return roomList.find((r) => r.roomId === sidebar.lastDMRoomId.value);
		return undefined;
	}

	onMounted(async () => {
		await loadPrivateRooms();

		if (isMobile.value) return;

		const target = findTargetRoom(sortedPrivateRooms.value);
		if (target) {
			openDMRoom(target);
			return;
		}
		if (sortedPrivateRooms.value.length > 0) {
			openDMRoom(sortedPrivateRooms.value[0]);
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

	async function handleAdminContact() {
		if (isMobile.value) {
			const adminRoom = await getOrCreateAdminRoom();
			if (adminRoom) openDMRoom(adminRoom);
			return;
		}

		// Desktop: toggle admin room visibility
		const visibleAdminRoom = privateRooms.value.find((r) => r.getType() === RoomType.PH_MESSAGE_ADMIN_CONTACT);
		if (visibleAdminRoom) {
			await pubhubs.setPrivateRoomHiddenStateForUser(visibleAdminRoom, true);
			if (selectedRoom.value?.roomId === visibleAdminRoom.roomId) {
				const next = sortedPrivateRooms.value.find((r) => r.roomId !== visibleAdminRoom.roomId);
				if (next) {
					openDMRoom(next);
				} else {
					selectedRoom.value = null;
				}
			}
			return;
		}

		const adminRoom = await getOrCreateAdminRoom();
		if (adminRoom) {
			openDMRoom(adminRoom);
		}
	}

	async function getOrCreateAdminRoom(): Promise<Room | null> {
		const existingAdminRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		if (existingAdminRoom) {
			await pubhubs.setPrivateRoomHiddenStateForUser(existingAdminRoom, false);
			return existingAdminRoom;
		}

		const userResponse = await dialog.yesno(t('admin.admin_contact_title'), t('admin.admin_contact_main_msg'));
		if (!userResponse) return null;

		const roomSetUpResponse = await pubhubs.setUpAdminRoom();
		if (typeof roomSetUpResponse === 'boolean' && roomSetUpResponse === false) {
			dialog.confirm(t('admin.if_admin_contact_not_present'));
			return null;
		} else if (typeof roomSetUpResponse === 'string') {
			const roomId = roomSetUpResponse;
			await rooms.joinRoomListRoom(roomId);
			return rooms.rooms[roomId] as Room;
		}
		return null;
	}

	async function loadPrivateRooms() {
		await rooms.waitForInitialRoomsLoaded();
		const roomsList = rooms.filteredRoomList(DirectRooms);
		for (const room of roomsList) {
			await rooms.joinRoomListRoom(room.roomId);
		}
	}

	function lastEventTimeStamp(room: Room): number {
		const messageEvents = room.getLiveTimelineEvents().filter((event) => event.getType() === EventType.RoomMessage);

		if (messageEvents.length === 0) {
			return Date.now();
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

	function onScrollToEventId(ev: { eventId: string; threadId?: string }) {
		scrollToEventId.value = ev.eventId;
	}
</script>
