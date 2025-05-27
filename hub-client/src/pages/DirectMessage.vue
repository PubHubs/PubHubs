<template>
	<HeaderFooter :headerSize="'sm'" :headerMobilePadding="true" bgBarLow="bg-background" bgBarMedium="bg-surface-low">
		<template #header>
			<div class="items-center gap-4 text-on-surface-dim" :class="isMobile ? 'hidden' : 'flex'">
				<span class="font-semibold uppercase">{{ $t('menu.directmsg') }}</span>
				<hr class="h-[2px] grow bg-on-surface-dim" />
			</div>
			<div class="relative flex h-full items-center justify-between gap-6" :class="isMobile ? 'pl-12' : 'pl-0'">
				<div class="flex flex-col">
					<H3 class="flex text-on-surface" :class="isMobile ? 'gap-2' : 'gap-4'">
						<Icon type="directmsg" size="sm" :class="isMobile ? 'mt-[0.5rem]' : 'mt-2'"></Icon>
						<TruncatedText class="font-headings font-semibold">
							<h2>{{ $t('menu.directmsg') }}</h2>
						</TruncatedText>
					</H3>
					<TruncatedText class="hidden md:inline"> </TruncatedText>
				</div>
				<div class="m-0 flex gap-2">
					<Button
						v-if="!user.isAdmin"
						size="sm"
						class="flex bg-on-surface-variant ~text-label-small-min/label-small-max hover:bg-surface-subtle dark:text-surface-high"
						:class="isMobile ? 'w-8 justify-center rounded-full' : 'justify-between gap-2'"
						@click="router.push({ name: 'admin-contact' })"
					>
						<Icon type="person" size="xs" class="mt-1"></Icon>
						<span v-if="!isMobile">{{ $t('menu.contact') }}</span>
						<span :class="isMobile ? 'absolute right-0 top-0' : 'flex gap-2 pl-2'">
							<Badge class="~text-label-small-min/label-small-max" color="ph" v-if="newAdminMsgCount > 99">99+</Badge>
							<Badge class="~text-label-small-min/label-small-max" v-else-if="newAdminMsgCount > 0" color="ph">{{ newAdminMsgCount }}</Badge>
						</span>
					</Button>
					<Button
						class="flex gap-2 bg-on-surface-variant ~text-label-small-min/label-small-max hover:bg-surface-subtle dark:text-surface-high"
						:class="isMobile ? 'mr-4 justify-center' : 'justify-between'"
						size="sm"
						@click="openConverationalPanel()"
						:disabled="panel"
					>
						<Icon type="plus" size="xs" class="py-1"></Icon>
						<span v-if="!isMobile">{{ $t('others.new_message') }}</span>
					</Button>
				</div>
			</div>
		</template>

		<div class="flex h-full max-w-screen-2xl flex-col px-4 py-4 md:px-16 md:py-10">
			<span v-if="privateRooms?.length === 0" class="mx-auto flex-shrink-0">
				{{ $t('others.no_private_message') }}
			</span>
			<div class="w-full transition-all duration-300 ease-in-out">
				<MessagePreview v-for="room in sortedPrivateRooms" :key="room.roomId" :room="room" :isMobile="isMobile"></MessagePreview>
			</div>
			<NewConverationPanel v-if="panel" @close="panel = false" :isMobile="isMobile"></NewConverationPanel>
		</div>
	</HeaderFooter>
</template>

<script setup lang="ts">
	// Component level imports
	import Button from '@/components/elements/Button.vue';
	import H3 from '@/components/elements/H3.vue';
	import Icon from '@/components/elements/Icon.vue';
	import TruncatedText from '@/components/elements/TruncatedText.vue';
	import HeaderFooter from '@/components/ui/HeaderFooter.vue';
	import MessagePreview from '@/components/ui/MessagePreview.vue';
	import NewConverationPanel from '@/components/rooms/NewConversationPanel.vue';

	// Store imports
	import { useSettings } from '@/logic/store/settings';
	import { Room, RoomType, useRooms } from '@/logic/store/rooms';

	// Vue imports
	import { computed, ref } from 'vue';

	import { NotificationCountType } from 'matrix-js-sdk';
	import { useUser } from '@/logic/store/user';
	import { router } from '@/logic/core/router';

	// Refs
	// const privateRooms = ref<Array<Room>>();
	const panel = ref<boolean>(false);

	// onMounted(() => {
	// 	// TODO: if privateRooms is empty then show a message that there are not private messages please start a new conversation.
	// 	privateRooms.value = getPrivateRooms();
	// });

	// Define store constants
	const settings = useSettings();
	const rooms = useRooms();
	const user = useUser();

	const isMobile = computed(() => settings.isMobileState);

	const privateRooms = computed<Array<Room>>(() => getPrivateRooms());

	const newAdminMsgCount = computed(() => {
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
		return [...privateRooms.value].sort((r1, r2) => {
			return lastEventTimeStamp(r2) - lastEventTimeStamp(r1);
		});
	});

	function getPrivateRooms(): Array<Room> {
		const dmRooms = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGES_DM) ?? [];
		const groupRooms = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGES_GROUP) ?? [];
		const adminRoom = rooms.fetchRoomArrayByType(RoomType.PH_MESSAGE_ADMIN_CONTACT) ?? [];
		return [...dmRooms, ...groupRooms, ...adminRoom];
	}

	function lastEventTimeStamp(room: Room): number {
		const messageEvents = room.getLiveTimelineEvents().filter((event) => event.getType() === 'm.room.message');

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
