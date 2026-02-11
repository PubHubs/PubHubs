<template>
	<HeaderFooter :headerSize="'sm'" :headerMobilePadding="true" bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="text-on-surface-dim items-center gap-4" :class="isMobile ? 'hidden' : 'flex'">
				<span class="font-semibold uppercase">{{ t('menu.directmsg') }}</span>
				<hr class="bg-on-surface-dim h-[2px] grow" />
			</div>
			<div class="relative flex h-full items-center justify-between gap-6" :class="isMobile ? 'pl-12' : 'pl-0'">
				<div class="flex w-fit items-center gap-3 overflow-hidden">
					<Icon type="chat-circle-text"></Icon>
					<H3 class="text-on-surface flex" :class="isMobile ? 'gap-2' : 'gap-4'">
						<TruncatedText class="font-headings font-semibold">
							<h2>{{ t('menu.directmsg') }}</h2>
						</TruncatedText>
					</H3>
					<TruncatedText class="hidden md:inline"> </TruncatedText>
				</div>
				<div class="flex gap-2">
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
						:class="isMobile ? 'mr-4 justify-center' : 'justify-between'"
						size="sm"
						@click="openConverationalPanel()"
						:disabled="panel"
					>
						<Icon type="plus" size="sm"></Icon>
						<span v-if="!isMobile">{{ t('others.new_message') }}</span>
					</Button>
				</div>
			</div>
		</template>

		<div class="flex h-full flex-col px-4 py-4 md:px-16 md:py-10">
			<span v-if="privateRooms?.length === 0" class="mx-auto flex-shrink-0">
				{{ t('others.no_private_message') }}
			</span>
			<div class="w-full transition-all duration-300 ease-in-out" role="list" data-testid="conversations">
				<MessagePreview v-for="room in sortedPrivateRooms" :key="room.roomId" :room="room" :isMobile="isMobile" class="hover:cursor-pointer" role="listitem"></MessagePreview>
			</div>
			<NewConverationPanel v-if="panel" @close="panel = false" :isMobile="isMobile"></NewConverationPanel>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, NotificationCountType } from 'matrix-js-sdk';
	import { computed, onMounted, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Badge from '@hub-client/components/elements/Badge.vue';
	import Button from '@hub-client/components/elements/Button.vue';
	import H3 from '@hub-client/components/elements/H3.vue';
	import Icon from '@hub-client/components/elements/Icon.vue';
	import TruncatedText from '@hub-client/components/elements/TruncatedText.vue';
	import NewConverationPanel from '@hub-client/components/rooms/NewConversationPanel.vue';
	import HeaderFooter from '@hub-client/components/ui/HeaderFooter.vue';
	import MessagePreview from '@hub-client/components/ui/MessagePreview.vue';

	// Logic
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';

	import { useDialog } from '@hub-client/stores/dialog';
	// Store imports
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { Room, useRooms } from '@hub-client/stores/rooms';
	import { useSettings } from '@hub-client/stores/settings';
	import { useUser } from '@hub-client/stores/user';

	const panel = ref<boolean>(false);
	const pubhubs = usePubhubsStore();
	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();
	const { t } = useI18n();
	const dialog = useDialog();

	onMounted(async () => {
		loadPrivateRooms();
	});

	const isMobile = computed(() => settings.isMobileState);

	const privateRooms = ref<Array<Room>>([]); // no computed, since this uses an async method

	/**
	 *  This should not be shown when
	 */
	const newAdminMsgCount = computed(() => {
		if (user.isAdmin) return; // No message preview for unread message count
		const adminContactRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT).pop();
		return adminContactRoom?.getUnreadNotificationCount(NotificationCountType.Total) ?? 0;
	});

	/**
	 * This is needed display the new message at the top.
	 * We sorted room based on timestamp
	 */
	const sortedPrivateRooms = computed(() => {
		if (!privateRooms.value) {
			return [];
		}

		//display by timestamp
		return [...privateRooms.value].sort((r1, r2) => {
			return lastEventTimeStamp(r2) - lastEventTimeStamp(r1);
		});
	});

	async function directMessageAdmin() {
		const userResponse = await dialog.yesno(t('admin.admin_contact_main_msg'));
		if (!userResponse) return;

		const roomSetUpResponse = await pubhubs.setUpAdminRoom();
		// Room Setup return to false means that the room was not set up.
		if (typeof roomSetUpResponse === 'boolean' && roomSetUpResponse === false) {
			dialog.confirm(t('admin.if_admin_contact_not_present'));
		} else if (typeof roomSetUpResponse === 'string') {
			await router.push({ name: 'room', params: { id: roomSetUpResponse } });
		}
	}

	async function loadPrivateRooms() {
		await rooms.waitForInitialRoomsLoaded(); // we need the roomslist, so wait till its loaded
		const roomsList = rooms.filteredRoomList(DirectRooms);
		for (const room of roomsList) {
			await rooms.joinRoomListRoom(room.roomId);
			privateRooms.value = [...privateRooms.value, rooms.rooms[room.roomId]];
		}
	}

	function lastEventTimeStamp(room: Room): number {
		const messageEvents = room.getLiveTimelineEvents().filter((event) => event.getType() === EventType.RoomMessage);

		if (messageEvents.length === 0) {
			return 0;
		}

		// Sort the message events by their localTimestamp in descending order
		// to ensure the latest message is at the beginning of the array.
		messageEvents.sort((a, b) => b.localTimestamp - a.localTimestamp);

		return messageEvents[0].localTimestamp;
	}

	function openConverationalPanel() {
		panel.value = true;
	}
</script>
