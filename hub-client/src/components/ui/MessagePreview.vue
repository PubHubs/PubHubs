<template>
	<div class="@container w-full rounded-xl p-4" :class="active ? 'bg-surface' : 'bg-surface-low'">
		<div class="flex min-w-0 gap-3">
			<Avatar class="shrink-0" :avatar-url="avatarOverrideUrl" :user-id="otherDMUserId" :icon="roomType === RoomType.PH_MESSAGES_DM ? 'user' : 'users'" />

			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<!-- Top row: name + meta -->
				<div class="flex items-baseline justify-between gap-2">
					<div class="flex min-w-0 items-baseline gap-2">
						<p class="truncate leading-tight font-bold">
							{{ displayName }}
						</p>
						<p v-if="isGroupOrContact" class="text-on-surface-dim hidden items-center gap-1 leading-tight @xs:flex">
							<span v-if="props.room.getType() === RoomType.PH_MESSAGE_STEWARD_CONTACT" class="truncate">({{ stewardSourceRoomName(props.room) }})</span>
							<template v-if="props.room.getType() !== RoomType.PH_MESSAGE_ADMIN_CONTACT">
								<span class="text-label-small">{{ props.room.getRoomMembers() }}</span>
								<Icon type="user" size="sm" />
							</template>
							<template v-else>
								<span v-if="getOtherUserDisplayName()" class="truncate"> - {{ getOtherUserDisplayName() }}</span>
							</template>
						</p>
						<p v-else-if="pseudonym" class="text-on-surface-dim text-label-small hidden truncate leading-tight @xs:block">
							{{ pseudonym }}
						</p>
					</div>
					<EventTime v-if="lastMessageTimestamp !== undefined && lastMessageTimestamp !== 0" :timestamp="lastMessageTimestamp" :showDate="true" :time-for-msg-preview="true" class="text-on-surface-dim shrink-0" />
				</div>

				<!-- Bottom row: message preview + badge -->
				<div class="flex items-center justify-between gap-2">
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
