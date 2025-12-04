<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<!-- Deleted Message -->
		<Icon v-if="deleted" type="trash" size="sm" />
		<p v-if="deleted" class="text-on-surface-dim overflow-hidden text-ellipsis">
			{{ t('message.delete.message_deleted') }}
		</p>

		<!-- Message with Mentions -->
		<div v-else-if="hasAnyMentions" class="relative max-w-[90ch] text-ellipsis">
			<P v-for="segment in messageSegments" :key="segment" class="inline">
				<!-- Normal text segment -->
				<span v-if="segment.type === 'text'">{{ segment.content }}</span>

				<!-- User Mention segment -->
				<span
					v-else-if="segment.type === 'user' && segment.tokenId"
					@click.once="userStore.goToUserRoom(segment.tokenId)"
					class="text-accent-primary cursor-pointer"
					@contextmenu="openMenu($event, [{ label: 'direct message', icon: 'chat-circle', onClick: () => userStore.goToUserRoom(segment.tokenId) }])"
					>{{ segment.displayName }}
				</span>

				<!-- Room Mention segment -->
				<span
					v-else-if="segment.type === 'room' && segment.tokenId && segment.id"
					@click="joinIfMember(segment.tokenId, segment.id)"
					class="relative"
					@contextmenu="openMenu($event, [{ label: 'join', icon: 'chats-circle', onClick: () => joinIfMember(segment.tokenId, segment.id) }])"
				>
					<span class="text-accent-primary cursor-pointer">{{ segment.displayName }}</span>
					<div v-if="activeMentionCard === segment.id && segment.tokenId">
						<RoomLoginDialog
							v-if="segment.type === 'room'"
							:secured="isSecured(segment.tokenId)"
							:dialogOpen="segment.tokenId"
							title="rooms.join_room"
							message="rooms.join_secured_room_dialog"
							:messageValues="[]"
							@close="activeMentionCard = null"
						/>
					</div>
				</span>
			</P>
		</div>

		<!-- Regular Message -->
		<p v-else v-html="messageContent" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useMentions } from '@hub-client/composables/useMentions';

	//Logic
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const roomsStore = useRooms();
	const userStore = useUser();
	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();
	const pubhubs = usePubhubsStore();
	const activeMentionCard = ref<string | null>(null);
	const mentionComposable = useMentions();

	// Regular message content (for non-deleted, non-mention messages)
	const messageContent = computed(() => {
		return props.event.content.ph_body;
	});

	/**
	 * Parse message body into segments with mentions replaced by displayName
	 */
	const messageSegments = computed(() => {
		if (props.deleted) return [];

		const body = props.event.content.body || '';
		const mentions = mentionComposable.parseMentions(body);

		return mentionComposable.buildSegments(body, mentions);
	});

	const hasAnyMentions = computed(() => {
		return messageSegments.value.some((seg) => seg.type !== 'text');
	});

	function isSecured(id: string) {
		return roomsStore.roomIsSecure(id);
	}
	async function joinIfMember(roomId: string, segmentId: string) {
		const userId = userStore.userId;
		if (userId) {
			const userIsMember = await pubhubs.isUserRoomMember(userId, roomId);
			if (userIsMember) {
				await router.push({ name: 'room', params: { id: roomId } });
			} else {
				activeMentionCard.value = segmentId;
			}
		}
	}
</script>
