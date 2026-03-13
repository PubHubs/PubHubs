<template>
	<div class="@container w-full rounded-xl p-4" :class="active ? 'bg-surface' : 'bg-surface-low'">
		<div class="flex gap-3">
			<Avatar class="shrink-0" :avatar-url="avatarOverrideUrl" :user-id="otherDMUserId" :icon="roomType === RoomType.PH_MESSAGES_DM ? 'user' : 'users'" />

			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<!-- Name + Timestamp -->
				<div class="flex items-baseline gap-2">
					<p class="min-w-0 flex-1 truncate leading-tight font-bold">{{ displayName }}</p>
					<EventTime v-if="lastMessageTimestamp" :timestamp="lastMessageTimestamp" :showDate="true" :time-for-msg-preview="true" class="text-on-surface-dim shrink-0" />
				</div>

				<!-- Secondary info -->
				<p v-if="secondaryInfo" class="text-label-small text-on-surface-dim hidden min-w-0 truncate leading-tight @xs:block">{{ secondaryInfo }}</p>

				<!-- Message preview + Unread badge -->
				<div class="flex items-center gap-2">
					<p v-if="room.hasMessages()" v-html="event?.getContent().ph_body" class="text-on-surface-dim min-w-0 flex-1 truncate"></p>
					<p v-else class="text-on-surface-dim min-w-0 flex-1 truncate">{{ t('rooms.no_messages_yet') }}</p>
					<Badge v-if="newMessage > 0" class="shrink-0">{{ newMessage }}</Badge>
				</div>
			</div>
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

	// Composables
	import { useModeration } from '@hub-client/composables/moderation.composable';

	// Logic
	import filters from '@hub-client/logic/core/filters';

	// Models
	import Room from '@hub-client/models/rooms/Room';
	import { RoomType } from '@hub-client/models/rooms/TBaseRoom';

	// Stores
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

	const userStore = useUser();
	const { t } = useI18n();
	const { stewardSourceRoomName } = useModeration();
	const avatarOverrideUrl = ref<string | undefined>(undefined);

	const roomType = computed(() => props.room.getType());

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

	const otherDMUserId = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_DM) {
			return getOtherDMUser()?.userId;
		}
		return undefined;
	});

	const newMessage = computed(() => props.room.getUnreadNotificationCount(NotificationCountType.Total));

	const latestMessageEvent = computed(() => {
		const events = props.room.getLiveTimelineEvents();
		const messageEvents = events.filter((event) => event.getType() === EventType.RoomMessage);
		if (messageEvents.length === 0) return undefined;
		return [...messageEvents].sort((a, b) => b.localTimestamp - a.localTimestamp)[0];
	});

	const event = latestMessageEvent;

	const lastMessageTimestamp = computed(() => event.value?.localTimestamp || 0);

	const displayName = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return props.room.name;
		if (roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');

		// Resolve userId from the member object, falling back to parsing the room name
		const userId = getOtherDMUser()?.userId ?? getOtherUserIdFromRoomName();
		if (!userId) return undefined;

		// userDisplayName is from the user profile store (populated via member state events).
		// Unlike rawDisplayName, it never falls back to the Matrix ID — so it's safe to use directly.
		// extractPseudonym is always a valid fallback when userId is known.
		return userStore.userDisplayName(userId) ?? filters.extractPseudonym(userId);
	});

	const secondaryInfo = computed(() => {
		const type = roomType.value;
		if (type === RoomType.PH_MESSAGES_DM) {
			const userId = getOtherDMUser()?.userId ?? getOtherUserIdFromRoomName();
			return userId ? filters.extractPseudonym(userId) : '';
		}
		if (type === RoomType.PH_MESSAGE_ADMIN_CONTACT) {
			return getOtherUserDisplayName();
		}
		if (type === RoomType.PH_MESSAGE_STEWARD_CONTACT) {
			const source = stewardSourceRoomName(props.room);
			const count = props.room.getRoomMembers();
			return source ? `(${source}) · ${count}` : String(count);
		}
		if (type === RoomType.PH_MESSAGES_GROUP) {
			return String(props.room.getRoomMembers());
		}
		return '';
	});

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

	// Parses the other user's Matrix ID from the room name (e.g. "@a:server,@b:server")
	// Used when the member object isn't in the Matrix client store yet.
	function getOtherUserIdFromRoomName(): string | undefined {
		return props.room.getMembersIdsFromName().find((id) => id !== userStore.userId);
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
