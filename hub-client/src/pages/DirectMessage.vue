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
				<!-- Admin contact button -->
				<div v-if="!user.isAdmin" class="relative">
					<GlobalBarButton type="lifebuoy" :selected="!isMobile && isAdminRoomVisible" @click="handleAdminContact()" />
					<Badge v-if="newAdminMsgCount > 99" class="text-label-small absolute -top-1 -right-1" color="ph">99+</Badge>
					<Badge v-else-if="newAdminMsgCount > 0" class="text-label-small absolute -top-1 -right-1" color="ph">{{ newAdminMsgCount }}</Badge>
				</div>

				<!-- Divider between admin contact and other buttons -->
				<div v-if="!user.isAdmin" class="bg-on-surface-disabled mx-1 h-6 w-px"></div>

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
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';
	import { useContextMenuStore } from '@hub-client/new-design/stores/contextMenu.store';

	const { openMenu } = useContextMenu();
	const contextMenuStore = useContextMenuStore();
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const { t } = useI18n();
	const dialog = useDialog();
	const sidebar = useSidebar();

	onMounted(async () => {
		loadPrivateRooms();
	});

	const isMobile = computed(() => settings.isMobileState);

	const selectedRoom = ref<Room | null>(null); // Selected room for desktop view
	const scrollToEventId = ref<string | undefined>(undefined); // For search result navigation

	// Reactive list of private rooms from the store
	// This includes admin contact rooms when they're visible (not hidden)
	const privateRooms = computed(() => rooms.loadedPrivateRooms);

	const newAdminMsgCount = computed(() => {
		if (user.isAdmin) return;
		const adminContactRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		return adminContactRoom?.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
	});

	// Check if admin room is currently visible (not hidden) in the store
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

	// Mobile conversation title - matches the title on conversation cards
	const mobileConversationTitle = computed(() => {
		const room = sidebar.selectedDMRoom.value;
		if (!room) return '';

		const roomType = room.getType();
		if (roomType === RoomType.PH_MESSAGES_GROUP) return room.name;
		if (roomType === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');

		// For 1:1 DMs, show the other user's display name
		const otherMembers = room.getOtherJoinedMembers();
		if (otherMembers.length > 0) {
			return otherMembers[0]?.rawDisplayName ?? t('menu.directmsg');
		}

		// Fallback: check not-invited members (for rooms where member hasn't fully joined yet)
		const notInvitedMemberIds = room.notInvitedMembersIdsOfPrivateRoom();
		if (notInvitedMemberIds.length > 0) {
			const member = room.getMember(notInvitedMemberIds[0]);
			return member?.rawDisplayName ?? t('menu.directmsg');
		}

		return t('menu.directmsg');
	});

	// Restore state when entering the DM page
	onMounted(() => {
		// Desktop: check if sidebar has a pre-selected room (from router navigation)
		if (!isMobile.value && sidebar.selectedDMRoom.value) {
			selectedRoom.value = sidebar.selectedDMRoom.value;
			return;
		}
		// Desktop: auto-select first room if available
		if (!isMobile.value && sortedPrivateRooms.value.length > 0 && !selectedRoom.value) {
			selectedRoom.value = sortedPrivateRooms.value[0];
		}
		// Mobile: don't auto-open any conversation (sidebar handles it)
	});

	// Watch for rooms to become available
	watch(
		sortedPrivateRooms,
		(newRooms) => {
			// Desktop: check if sidebar has a pre-selected room (from router navigation)
			if (!isMobile.value && sidebar.selectedDMRoom.value && !selectedRoom.value) {
				// Find the room in the loaded rooms list
				const preSelectedRoom = newRooms.find((r) => r.roomId === sidebar.selectedDMRoom.value?.roomId);
				if (preSelectedRoom) {
					selectedRoom.value = preSelectedRoom;
					return;
				}
			}
			// Desktop: auto-select first room if none selected
			if (!isMobile.value && newRooms.length > 0 && !selectedRoom.value) {
				selectedRoom.value = newRooms[0];
			}
			// Mobile: don't auto-open any conversation (sidebar handles it)
		},
		{ once: true },
	);

	// Sync selectedRoom when sidebar's selectedDMRoom changes
	// This handles the case when we're already on the DM page and a new room is selected via sidebar.openDMRoom
	watch(
		() => sidebar.selectedDMRoom.value,
		(newRoom) => {
			if (!newRoom) return;

			// Desktop: set as selected room
			if (!isMobile.value) {
				selectedRoom.value = newRoom;
			}
			// Note: No need to manually add to privateRooms - the computed handles it automatically
		},
	);

	// Close sidebar instantly before leaving to prevent animation when entering room pages
	onBeforeRouteLeave((to) => {
		if (to.name === 'room') {
			sidebar.closeInstantly();
		}
	});

	async function handleAdminContact() {
		// Mobile: open admin room directly in sidebar
		if (isMobile.value) {
			const adminRoom = await getOrCreateAdminRoom();
			if (adminRoom) {
				openDMRoom(adminRoom);
			}
			return;
		}

		// Desktop: toggle visibility in the list
		const visibleAdminRoom = privateRooms.value.find((r) => r.getType() === RoomType.PH_MESSAGE_ADMIN_CONTACT);
		if (visibleAdminRoom) {
			// Hide it from the list (computed will automatically update)
			await pubhubs.setPrivateRoomHiddenStateForUser(visibleAdminRoom, true);

			// Clear selection if it was selected
			if (selectedRoom.value?.roomId === visibleAdminRoom.roomId) {
				selectedRoom.value = sortedPrivateRooms.value[0] ?? null;
			}
			return;
		}

		// Show admin room in list (unhide or create) and select it
		const adminRoom = await getOrCreateAdminRoom();
		if (adminRoom) {
			selectedRoom.value = adminRoom;
		}
	}

	async function getOrCreateAdminRoom(): Promise<Room | null> {
		// Check if admin room exists (visible or hidden)
		const existingAdminRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		if (existingAdminRoom) {
			// Unhide if hidden
			await pubhubs.setPrivateRoomHiddenStateForUser(existingAdminRoom, false);
			return existingAdminRoom;
		}

		// No admin room exists, create one
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
		await rooms.waitForInitialRoomsLoaded(); // we need the roomslist, so wait till its loaded
		const roomsList = rooms.filteredRoomList(DirectRooms);
		// Join all rooms to ensure they're loaded in the store
		// The computed privateRooms will automatically pick them up
		for (const room of roomsList) {
			await rooms.joinRoomListRoom(room.roomId);
		}
	}

	function lastEventTimeStamp(room: Room): number {
		const messageEvents = room.getLiveTimelineEvents().filter((event) => event.getType() === EventType.RoomMessage);

		if (messageEvents.length === 0) {
			return 0;
		}

		messageEvents.sort((a, b) => b.localTimestamp - a.localTimestamp);
		return messageEvents[0].localTimestamp;
	}

	function openDMRoom(room: Room) {
		if (isMobile.value) {
			// Mobile: open in sidebar
			sidebar.openDMRoom(room);
		} else {
			// Desktop: show directly
			selectedRoom.value = room;
		}
	}

	function onScrollToEventId(ev: { eventId: string; threadId?: string }) {
		scrollToEventId.value = ev.eventId;
	}
</script>
