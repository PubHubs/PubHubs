<template>
	<div v-if="room.hasMessages()" class="mx-auto my-2 rounded-xl px-4 py-1" :class="newMessage ? 'bg-surface-high' : 'bg-surface-low'" @click="goToRoom">
		<div class="flex min-w-0 items-center gap-4" :class="{ 'font-bold': newMessage }">
			<Avatar :class="'flex-shrink-0'" :user="avatarUser" :override-avatar-url="avatarOverrideUrl" />

			<div class="min-w-0 flex-grow overflow-hidden">
				<div :class="isMobile ? 'flex flex-col gap-1' : 'flex flex-row items-center gap-4'">
					<div :class="isMobile ? 'flex-row items-center gap-2' : 'flex-col'" class="flex">
						<p class="font-bold leading-tight" :class="{ truncate: isMobile }">
							{{ displayName }}
						</p>

						<p v-if="isGroupOrContact" class="flex items-center leading-tight ~text-label-small-min/label-small-max">
							<span>{{ props.room.getRoomMembers() }}</span>
							<Icon type="user" size="sm" class="mr-1" />
							<span v-if="!isMobile">members</span>
						</p>
						<p v-else class="leading-tight ~text-label-small-min/label-small-max" :class="{ 'mt-[0.1rem] truncate': isMobile }">
							{{ pseudonym }}
						</p>
					</div>

					<!-- Right Section: Message Body -->
					<div class="min-w-0 flex-grow">
						<p class="truncate text-left">
							{{ event.getContent().ph_body }}
						</p>
					</div>
				</div>
			</div>

			<Badge v-if="newMessage > 0" color="notification" class="aspect-square h-full flex-shrink-0">
				{{ newMessage }}
			</Badge>

			<EventTime v-if="lastMessageTimestamp !== undefined && lastMessageTimestamp !== 0" :timestamp="lastMessageTimestamp" :showDate="true" :time-for-msg-preview="true" class="flex-shrink-0" />
		</div>
	</div>
</template>

<script setup lang="ts">
	import { computed } from 'vue';
	import { useRouter } from 'vue-router';
	import { NotificationCountType, RoomMember } from 'matrix-js-sdk';
	import { useI18n } from 'vue-i18n';

	import filters from '@/logic/core/filters';
	import Room from '@/model/rooms/Room';
	import { RoomType } from '@/model/rooms/TBaseRoom';

	import Avatar from './Avatar.vue';
	import Badge from '../elements/Badge.vue';
	import EventTime from '../rooms/EventTime.vue';

	const router = useRouter();
	const { t } = useI18n();

	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		isMobile: {
			type: Boolean,
			default: false,
		},
	});

	const roomType = computed(() => props.room.getType());

	const newMessage = computed(() => props.room.getUnreadNotificationCount(NotificationCountType.Total));

	// In your script setup
	const latestMessageEvent = computed(() => {
		// Replace with actual SDK method if available
		const events = props.room.getLiveTimelineEvents();
		// Find the latest message event
		const messageEvents = events.filter((event) => event.getType() === 'm.room.message');
		if (messageEvents.length === 0) return undefined;
		return [...messageEvents].sort((a, b) => b.localTimestamp - a.localTimestamp)[0];
	});

	const event = latestMessageEvent; // This would now be the latest message event

	const lastMessageTimestamp = computed(() => {
		return event.value?.localTimestamp || 0;
	});

	// No user is needed for Room Avatar, we just override img url. We don't have a Room Avatar.
	const avatarUser = computed(() => {
		const sender = getOtherDMUser()?.userId;

		if (!sender || roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return undefined;
		return props.room.getMember(sender, true);
	});

	const avatarOverrideUrl = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) {
			return props.room.getRoomAvatarMxcUrl() ?? undefined;
		}
		return undefined;
	});

	const displayName = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return props.room.name;
		if (roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('menu.contact');

		return getOtherDMUser()?.rawDisplayName;
	});

	const pseudonym = computed(() => (getOtherDMUser()?.userId ? filters.extractPseudonym(getOtherDMUser()?.userId) : ''));

	const isGroupOrContact = computed(() => roomType.value === RoomType.PH_MESSAGES_GROUP || roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT);

	function goToRoom() {
		router.push({ name: 'room', params: { id: props.room.roomId } });
	}

	function getOtherDMUser(): RoomMember | null | undefined {
		if (roomType.value !== RoomType.PH_MESSAGES_DM) return;

		const otherMembers = props.room.getOtherJoinedMembers();
		if (otherMembers.length > 0) {
			return otherMembers[0] as RoomMember;
		} else {
			return event.value?.sender;
		}
	}
</script>
