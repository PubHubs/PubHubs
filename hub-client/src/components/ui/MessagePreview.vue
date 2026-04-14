<template>
	<div
		class="@container w-full rounded-xl p-4"
		:class="active ? 'bg-surface' : 'bg-surface-low'"
	>
		<div class="flex gap-3">
			<Avatar
				:avatar-url="avatarOverrideUrl"
				class="shrink-0"
				:icon="roomType === RoomType.PH_MESSAGES_DM ? 'user' : 'users'"
				:user-id="displayUserId"
			/>

			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<!-- Name + Timestamp -->
				<div class="flex items-baseline gap-2">
					<UserDisplayName
						v-if="displayUserId"
						class="min-w-0 flex-1"
						:show-pseudonym="false"
						:user-display-name="userStore.userDisplayName(displayUserId)"
						:user-id="displayUserId"
					/>
					<p
						v-else
						class="min-w-0 flex-1 truncate leading-tight font-bold"
					>
						{{ displayName }}
					</p>
					<EventTime
						v-if="lastMessageTimestamp"
						class="text-on-surface-dim shrink-0"
						:show-date="true"
						:time-for-msg-preview="true"
						:timestamp="lastMessageTimestamp"
					/>
				</div>

				<!-- Secondary info -->
				<p
					v-if="secondaryInfo"
					class="text-label-small text-on-surface-dim hidden min-w-0 truncate leading-tight @xs:block"
				>
					{{ secondaryInfo }}
				</p>

				<!-- Message preview + Unread badge -->
				<div class="flex items-center gap-2">
					<div
						v-if="room.hasMessages()"
						class="text-on-surface-dim flex min-w-0 flex-1 items-center gap-1 truncate"
					>
						<Icon
							v-if="preview.icon"
							class="shrink-0"
							size="sm"
							:type="preview.icon"
						/>
						<span class="truncate">{{ preview.text }}</span>
					</div>
					<p
						v-else
						class="text-on-surface-dim min-w-0 flex-1 truncate"
					>
						{{ t('rooms.no_messages_yet') }}
					</p>
					<Badge
						v-if="newMessage > 0"
						data-testid="unread-badge"
						class="shrink-0"
					>
						{{ newMessage }}
					</Badge>
				</div>
			</div>
		</div>
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { EventType, MsgType, NotificationCountType } from 'matrix-js-sdk';
	import { computed, ref, watch } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import EventTime from '@hub-client/components/rooms/EventTime.vue';
	import UserDisplayName from '@hub-client/components/rooms/UserDisplayName.vue';
	import Avatar from '@hub-client/components/ui/Avatar.vue';

	// Composables
	import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';
	import { useModeration } from '@hub-client/composables/moderation.composable';

	// Logic
	import { PubHubsMgType } from '@hub-client/logic/core/events';
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
	const { formatMentions } = useMentionsDisplay();
	const avatarOverrideUrl = ref<string | undefined>(undefined);

	const roomType = computed(() => props.room.getType());

	const displayUserId = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_DM) {
			return getOtherDMUserId() ?? getOtherUserIdFromRoomName();
		}
		return undefined;
	});

	// For DMs, reactively resolve avatar from user profile store.
	// For other room types, fetch the room avatar URL (async, so use a watcher).
	watch(
		[() => props.room, () => (displayUserId.value ? userStore.userAvatar(displayUserId.value) : undefined)],
		async ([room, dmAvatarUrl]) => {
			if (!room) {
				avatarOverrideUrl.value = undefined;
				return;
			}
			if (room.getType() === RoomType.PH_MESSAGES_DM) {
				avatarOverrideUrl.value = dmAvatarUrl;
				return;
			}
			avatarOverrideUrl.value = await props.room.getRoomAvatarAuthorizedUrl();
		},
		{ immediate: true },
	);

	const newMessage = computed(() => props.room.getUnreadNotificationCount(NotificationCountType.Total));

	const latestMessageEvent = computed(() => {
		const events = props.room.getLiveTimelineEvents();
		const messageEvents = events.filter((event) => event.getType() === EventType.RoomMessage);
		if (messageEvents.length === 0) return undefined;
		return [...messageEvents].sort((a, b) => b.localTimestamp - a.localTimestamp)[0];
	});

	const event = latestMessageEvent;

	const lastMessageTimestamp = computed(() => event.value?.localTimestamp || 0);

	const preview = computed((): { icon: string | null; text: string } => {
		const ev = event.value;
		if (!ev) return { icon: null, text: '' };

		const content = ev.getContent();
		const msgtype: string = content.msgtype ?? '';

		if (msgtype === MsgType.Image) return { icon: 'image-square', text: t('rooms.preview_image') };
		if (msgtype === MsgType.File) return { icon: 'file', text: content.body || t('rooms.preview_file') };
		if (msgtype === PubHubsMgType.SignedMessage) return { icon: 'seal-check', text: t('rooms.preview_signed') };
		if (msgtype.startsWith('pubhubs.voting_widget')) return { icon: 'chart-bar', text: t('rooms.preview_poll') };

		// For text and announcement, use plain-text body
		const body: string = content.body || '';
		if (!body) return { icon: null, text: t('rooms.preview_unknown') };

		// Strip Matrix reply-fallback quote lines ("> quoted text")
		const stripped = body
			.split('\n')
			.filter((line) => !line.startsWith('> '))
			.join('\n')
			.trim();

		const resolved = formatMentions(stripped);

		const isReply = !!content['m.relates_to']?.['m.in_reply_to']?.event_id;
		if (isReply) return { icon: null, text: `↩ ${resolved || '…'}` };

		return { icon: null, text: resolved || t('rooms.preview_unknown') };
	});

	const displayName = computed(() => {
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return props.room.name;
		if (roomType.value === RoomType.PH_MESSAGE_ADMIN_CONTACT) return t('admin.support');
		if (roomType.value === RoomType.PH_MESSAGE_STEWARD_CONTACT) return t('rooms.steward_support');

		// Resolve userId from the member object, falling back to parsing the room name
		const userId = getOtherDMUserId() ?? getOtherUserIdFromRoomName();
		if (!userId) return undefined;

		// userDisplayName is from the user profile store (populated via member state events).
		// Unlike rawDisplayName, it never falls back to the Matrix ID — so it's safe to use directly.
		// extractPseudonym is always a valid fallback when userId is known.
		return userStore.userDisplayName(userId) ?? filters.extractPseudonym(userId);
	});

	const secondaryInfo = computed(() => {
		const type = roomType.value;
		if (type === RoomType.PH_MESSAGES_DM) {
			const userId = getOtherDMUserId() ?? getOtherUserIdFromRoomName();
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

	function getOtherDMUserId(): string | null | undefined {
		// For avatars - there needs to be a valid user if the override url needs to work.
		if (roomType.value === RoomType.PH_MESSAGES_GROUP) return event.value?.getSender();
		if (roomType.value !== RoomType.PH_MESSAGES_DM) return;

		const { allOtherMembers } = useModeration(props.room);
		if (allOtherMembers.value.length > 0) {
			return allOtherMembers.value[0];
		} else {
			const notInvitedMembersIds = props.room.notInvitedMembersIdsOfPrivateRoom();
			return props.room.getMember(notInvitedMembersIds[0])?.userId;
		}
	}

	// Parses the other user's Matrix ID from the room name (e.g. "@a:server,@b:server")
	// Used when the member object isn't in the Matrix client store yet.
	function getOtherUserIdFromRoomName(): string | undefined {
		return props.room.getMembersIdsFromName().find((id) => id !== userStore.userId);
	}

	function getOtherUserDisplayName(): string | undefined {
		// Admin contact has a private one-to-one room
		const { allOtherMembers } = useModeration(props.room);
		if (allOtherMembers.value.length > 1) return undefined;
		return allOtherMembers.value.map((userId) => userStore.userDisplayName(userId)).pop();
	}
</script>
