<template>
	<div v-if="room.hasMessages()" class="mx-auto my-2 rounded-xl px-4 py-1" :class="newMessage ? 'bg-surface-high' : 'bg-surface-low'" @click="goToRoom">
		<div class="flex min-w-0 items-center gap-4" :class="{ 'font-bold': newMessage }">
			<AvatarCore :class="'flex-shrink-0'" :user="avatarUser" :img="avatarOverrideUrl" icon="two_users" />

			<div class="min-w-0 flex-grow overflow-hidden">
				<div class="flex flex-col gap-1">
					<div class="flex flex-row items-center gap-2">
						<p class="truncate font-bold leading-tight" :class="{ truncate: !isMobile }">
							{{ displayName }}
						</p>
						<p v-if="isGroupOrContact" class="flex items-center leading-tight">
							<template v-if="props.room.getType() !== RoomType.PH_MESSAGE_ADMIN_CONTACT">
								<span class="~text-label-small-min/label-small-max">{{ props.room.getRoomMembers() }}</span>
								<Icon type="user" size="sm" class="mr-1" />
								<span class="~text-label-small-min/label-small-max">{{ $t('others.group_members') }}</span>
							</template>
							<template v-else>
								<span class="truncate font-bold" v-if="getOtherUserDisplayName()"> - {{ getOtherUserDisplayName() }}</span>
							</template>
						</p>
						<p v-else class="leading-tight ~text-label-small-min/label-small-max" :class="{ 'mt-[0.1rem] truncate': isMobile }">
							{{ pseudonym }}
						</p>
					</div>

					<!-- Right Section: Message Body -->
					<div class="mt-1 min-w-0">
						<p v-html="event.getContent().ph_body" class="truncate"></p>
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
	import { EventType, NotificationCountType, RoomMember } from 'matrix-js-sdk';
	import { useI18n } from 'vue-i18n';

	import filters from '@/logic/core/filters';
	import Room from '@/model/rooms/Room';
	import { RoomType } from '@/model/rooms/TBaseRoom';

	import AvatarCore from './AvatarCore.vue';
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
		const messageEvents = events.filter((event) => event.getType() === EventType.RoomMessage);
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
		if (roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');
		return getOtherDMUser()?.rawDisplayName;
	});

	const pseudonym = computed(() => (getOtherDMUser()?.userId ? filters.extractPseudonym(getOtherDMUser()?.userId) : ''));

	const isGroupOrContact = computed(() => roomType.value === RoomType.PH_MESSAGES_GROUP || roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT || roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT);

	function goToRoom() {
		router.push({ name: 'room', params: { id: props.room.roomId } });
	}

	function getOtherDMUser(): RoomMember | null | undefined {
		// Due to how avatar is implemented  this is a quick fix for group avatar.
		// For avatars - there needs to be a valid user if the override url needs to work.
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return event.value?.sender;

		if (roomType.value !== RoomType.PH_MESSAGES_DM) return;

		const otherMembers = props.room.getOtherJoinedMembers();
		if (otherMembers.length > 0) {
			return otherMembers[0] as RoomMember;
		} else {
			const notInvitedMembersIds = props.room.notInvitedMembersIdsOfPrivateRoom();
			return props.room.getMember(notInvitedMembersIds[0]);
		}
	}

	function getOtherUserDisplayName(): string | undefined {
		// Admin contact has a private one-to-one room
		if (props.room.getOtherJoinedMembers().length > 1) return undefined;
		return props.room
			.getOtherJoinedMembers()
			.map((event) => event.rawDisplayName)
			.pop();
	}
</script>
