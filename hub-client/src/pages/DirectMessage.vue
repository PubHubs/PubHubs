<template>
	<div class="flex h-full flex-col">
		<!-- Shared Header -->
		<div class="border-on-surface-disabled flex h-[80px] shrink-0 items-center justify-between border-b p-8" :class="isMobile ? 'pl-8' : 'pl-8'">
			<!-- Left: DM title -->
			<div class="flex w-fit items-center gap-3 overflow-hidden">
				<Icon type="chat-circle-text" />
				<H3 class="text-on-surface flex" :class="isMobile ? 'gap-2' : 'gap-4'">
					<TruncatedText class="font-headings font-semibold">
						<h2>{{ t('menu.directmsg') }}</h2>
					</TruncatedText>
				</H3>
				<TruncatedText class="hidden md:inline" />
			</div>

			<!-- Right: Buttons -->
			<div class="flex items-center gap-2">
				<!-- Close button (only when sidebar is open) - positioned at left of icon row -->
				<button v-if="sidebar.isOpen.value" class="hover:bg-surface-variant rounded-md p-2 transition-colors" :aria-label="t('global.close')" @click="sidebar.close()">
					<Icon type="arrow-right" size="base" />
				</button>

				<Button
					v-if="!user.isAdmin"
					size="sm"
					class="bg-on-surface-variant text-surface-high text-label-small flex items-center gap-1 overflow-visible"
					:class="[isMobile ? 'w-8 justify-center rounded-full' : 'justify-between']"
					@click="directMessageAdmin()"
				>
					<Icon type="headset" size="sm"></Icon>
					<span v-if="!isMobile">{{ t('menu.contact') }}</span>
					<span :class="isMobile ? 'absolute -top-2 -right-2' : 'absolute -top-2 -right-2 flex items-center gap-2'">
						<Badge class="text-label-small" color="ph" v-if="newAdminMsgCount > 99">99+</Badge>
						<Badge class="text-label-small" color="ph" v-else-if="newAdminMsgCount > 0">{{ newAdminMsgCount }}</Badge>
					</span>
				</Button>

				<Button
					class="bg-on-surface-variant text-surface-high text-label-small flex items-center gap-1"
					:class="isMobile ? 'justify-center' : 'justify-between'"
					size="sm"
					@click="sidebar.setTab(SidebarTab.NewDM)"
					:disabled="sidebar.activeTab.value === SidebarTab.NewDM"
				>
					<Icon type="plus" size="sm" />
					<span v-if="!isMobile">{{ t('others.new_message') }}</span>
				</Button>
			</div>
		</div>

		<!-- Content row: Message list + Sidebar -->
		<div class="flex flex-1 overflow-hidden">
			<div class="flex h-full w-full flex-col overflow-y-auto px-4 py-4 md:px-16 md:py-10">
				<span v-if="privateRooms?.length === 0" class="mx-auto shrink-0">
					{{ t('others.no_private_message') }}
				</span>
				<div class="w-full transition-all duration-300 ease-in-out" role="list" data-testid="conversations">
					<MessagePreview v-for="room in sortedPrivateRooms" :key="room.roomId" :room="room" :isMobile="isMobile" class="hover:cursor-pointer" role="listitem" @click="openDMRoom(room)" />
				</div>
			</div>

			<!-- DM Sidebar -->
			<RoomSidebar :active-tab="sidebar.activeTab.value" :is-mobile="sidebar.isMobile.value">
				<NewConversationPanel v-if="sidebar.activeTab.value === SidebarTab.NewDM" :isMobile="isMobile" @close="sidebar.close()" />
				<DirectMessageRoom v-if="sidebar.activeTab.value === SidebarTab.DirectMessage && sidebar.selectedDMRoom.value" :room="sidebar.selectedDMRoom.value" />
			</RoomSidebar>
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, NotificationCountType } from 'matrix-js-sdk';
	import { computed, onUnmounted } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import DirectMessageRoom from '@hub-client/components/rooms/DirectMessageRoom.vue';
	import NewConversationPanel from '@hub-client/components/rooms/NewConversationPanel.vue';
	import RoomSidebar from '@hub-client/components/rooms/RoomSidebar.vue';
	import MessagePreview from '@hub-client/components/ui/MessagePreview.vue';

	// Composable
	import { SidebarTab, useSidebar } from '@hub-client/composables/useSidebar';

	// Logic
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Store
	import { useDialog } from '@hub-client/stores/dialog';
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { Room, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const { t } = useI18n();
	const dialog = useDialog();
	const sidebar = useSidebar();
	const isMobile = computed(() => settings.isMobileState);
	const privateRooms = computed<Array<Room>>(() => getPrivateRooms());

	// Close sidebar when leaving this page
	onUnmounted(() => {
		sidebar.close();
	});

	const newAdminMsgCount = computed(() => {
		if (user.isAdmin) return;
		const adminContactRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		return adminContactRoom?.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
	});

	const sortedPrivateRooms = computed(() => {
		if (!privateRooms.value) {
			return [];
		}

		return [...privateRooms.value].sort((r1, r2) => {
			return lastEventTimeStamp(r2) - lastEventTimeStamp(r1);
		});
	});

	async function directMessageAdmin() {
		const userResponse = await dialog.yesno(t('admin.admin_contact_main_msg'));
		if (!userResponse) return;

		const roomSetUpResponse = await pubhubs.setUpAdminRoom();
		if (typeof roomSetUpResponse === 'boolean' && roomSetUpResponse === false) {
			dialog.confirm(t('admin.if_admin_contact_not_present'));
		} else if (typeof roomSetUpResponse === 'string') {
			await router.push({ name: 'room', params: { id: roomSetUpResponse } });
		}
	}

	function getPrivateRooms(): Array<Room> {
		return rooms.fetchRoomArrayByAccessibility(DirectRooms);
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
		sidebar.openDMRoom(room);
	}
</script>
