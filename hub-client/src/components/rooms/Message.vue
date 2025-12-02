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
				<span v-else-if="segment.type === 'user'" @click.once="goToUserRoom(segment.tokenId!)" class="text-accent-primary cursor-pointer" @contextmenu="userMentionMenu">{{ segment.displayName }}</span>
				<!-- Room Mention segment -->
				<span v-else-if="segment.type === 'room'" @click="activeMentionCard = segment.id" class="relative" @contextmenu="roomMentionMenu">
					<span class="text-accent-primary cursor-pointer">{{ segment.displayName }}</span>
					<div v-if="activeMentionCard === segment.id && segment.tokenId">
						<RoomLoginDialog v-if="segment.type === 'room'" :secured="isSecured(segment.tokenId)" :dialogOpen="segment.tokenId" title="test" message="test" :messageValues="[]" @close="activeMentionCard = null" />
					</div>
				</span>
			</P>
		</div>

		<!-- Regular Message -->
		<p v-else v-html="messageContent" class="overflow-hidden text-ellipsis"></p>
	</div>
</template>

<script setup lang="ts">
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	import Icon from '@hub-client/components/elements/Icon.vue';

	import { useMentions } from '@hub-client/composables/useMentions';

	import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { User } from '@hub-client/stores/user';

	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const { t } = useI18n();
	const roomsStore = useRooms();
	const pubhubs = usePubhubsStore();
	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();

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

	const roomMention = [{ label: 'join', icon: 'chats-circle', onClick: () => console.error('Open1') }];
	const { openMenu: roomMentionMenu } = useContextMenu(roomMention);

	const userMention = [{ label: 'direct message', icon: 'chat-circle', onClick: () => console.error('Open1') }];
	const { openMenu: userMentionMenu } = useContextMenu(userMention);

	function isSecured(id: string) {
		console.error(id);
		return roomsStore.roomIsSecure(id);
	}
	async function goToUserRoom(userId: string) {
		let userRoom;
		const otherUser = pubhubs.client.getUser(userId) as User;
		if (otherUser) {
			userRoom = await pubhubs.createPrivateRoomWith(otherUser);
			if (userRoom) {
				await pubhubs.routeToRoomPage(userRoom);
			}
		}
	}
</script>
