<template>
	<div class="w-full rounded-xl p-4" :class="active ? 'bg-surface' : 'bg-surface-low'">
		<div class="flex h-full min-w-0 items-center gap-4" :class="{ 'font-bold': newMessage }">
			<Avatar :class="'shrink-0'" :avatar-url="avatarOverrideUrl" :user-id="otherDMUserId" :icon="roomType === RoomType.PH_MESSAGES_DM ? 'user' : 'users'" />
			<div class="min-w-0 grow overflow-hidden">
				<div class="flex flex-col gap-1">
					<div class="flex flex-row items-center gap-2">
						<p class="truncate leading-tight font-bold" :class="{ truncate: !isMobile }">
							{{ displayName }}
						</p>
						<p v-if="isGroupOrContact" class="flex items-center leading-tight">
							<span class="mr-2 truncate leading-tight font-bold" v-if="props.room.getType() === RoomType.PH_MESSAGE_STEWARD_CONTACT">({{ rooms.fetchRoomById(props.room.name.split(',')[0])?.name ?? '' }})</span>
							<template v-if="props.room.getType() !== RoomType.PH_MESSAGE_ADMIN_CONTACT">
								<span class="text-label-small">{{ props.room.getRoomMembers() }}</span>
								<Icon type="user" size="sm" class="mr-1" />
								<span class="text-label-small">{{ $t('others.group_members') }}</span>
							</template>
							<template v-else>
								<span class="truncate font-bold" v-if="getOtherUserDisplayName()"> - {{ getOtherUserDisplayName() }}</span>
							</template>
						</p>
						<p v-else class="text-label-small leading-tight" :class="{ 'mt-[0.1rem] truncate': isMobile }">
							{{ pseudonym }}
						</p>
					</div>

					<!-- Right section: Message body -->
					<div v-if="room.hasMessages()" class="mt-1 min-w-0">
						<p v-html="event?.getContent().ph_body" class="line-clamp-1 truncate"></p>
					</div>
					<div v-if="!room.hasMessages()" class="mt-1 min-w-0">
						<p class="line-clamp-1 truncate">{{ t('rooms.no_messages_yet') }}</p>
					</div>
				</div>
			</div>

			<Badge v-if="newMessage > 0" class="aspect-square h-1 shrink-0">
				{{ newMessage }}
			</Badge>

			<EventTime v-if="lastMessageTimestamp !== undefined && lastMessageTimestamp !== 0" :timestamp="lastMessageTimestamp" :showDate="true" :time-for-msg-preview="true" class="shrink-0" />
		</div>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { EventType, NotificationCountType, RoomMember } from 'matrix-js-sdk';
	import { computed, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// Props
	const props = defineProps({
		room: {
			type: Room,
			required: true,
		},
		isMobile: {
			type: Boolean,
			default: false,
		},
		active: {
			type: Boolean,
			default: false,
		},
	});

	const rooms = useRooms();
	const userStore = useUser();
	const { t } = useI18n();
	const avatarOverrideUrl = ref<string | undefined>(undefined);

	watch(
		() => props.room,
		async (room) => {
			if (!room) {
				avatarOverrideUrl.value = undefined;
				return;
			}
			// For 1:1 DMs, use the other user's avatar
			if (room.getType() === RoomType.PH_MESSAGES_DM) {
				const otherUser = getOtherDMUser();
				if (otherUser?.userId) {
					avatarOverrideUrl.value = userStore.userAvatar(otherUser.userId);
					return;
				}
			}
			avatarOverrideUrl.value = await props.room.getRoomAvatarAuthorizedUrl();
		},
		{ immediate: true },
	);

	const roomType = computed(() => props.room.getType());

	const otherDMUserId = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_DM) {
			return getOtherDMUser()?.userId;
		}
		return undefined;
	});

	const newMessage = computed(() => props.room.getUnreadNotificationCount(NotificationCountType.Total));

	const latestMessageEvent = computed(() => {
		const events = props.room.getLiveTimelineEvents();

		// Find the latest message event
		const messageEvents = events.filter((event) => event.getType() === EventType.RoomMessage);
		if (messageEvents.length === 0) return undefined;
		return [...messageEvents].sort((a, b) => b.localTimestamp - a.localTimestamp)[0];
	});

	const event = latestMessageEvent;

	const lastMessageTimestamp = computed(() => {
		return event.value?.localTimestamp || 0;
	});

	const displayName = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return props.room.name;
		if (roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');
		return getOtherDMUser()?.rawDisplayName;
	});

	const pseudonym = computed(() => (getOtherDMUser()?.userId ? filters.extractPseudonym(getOtherDMUser()!.userId) : ''));

	const isGroupOrContact = computed(() => roomType.value === RoomType.PH_MESSAGES_GROUP || roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT || roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT);

	function getOtherDMUser(): RoomMember | null | undefined {
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
