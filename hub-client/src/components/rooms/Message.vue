<template>
	<div class="flex flex-row items-center gap-1 wrap-break-word">
		<!-- Deleted Message -->
		<Icon
			v-if="deleted"
			class="text-on-surface-dim"
			size="sm"
			type="trash"
		/>
		<p
			v-if="deleted"
			class="text-on-surface-dim overflow-hidden text-ellipsis"
		>
			{{ t('message.delete.message_deleted') }}
		</p>

		<!-- Message with Mentions -->
		<div
			v-else-if="hasAnyMentions"
			class="relative max-w-[90ch] text-ellipsis"
		>
			<P
				v-for="segment in messageSegments"
				:key="segment"
				class="inline"
			>
				<!-- Normal text segment -->
				<span v-if="segment.type === 'text'">{{ segment.content }}</span>

				<!-- User Mention segment -->
				<span
					v-else-if="segment.type === 'user' && segment.tokenId"
					v-context-menu="
						(evt: any) =>
							openMenu(evt, [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => userStore.goToUserRoom(segment.tokenId!) }])
					"
					class="no-callout text-accent-primary cursor-pointer select-none"
					@click.once="userStore.goToUserRoom(segment.tokenId)"
					>{{ segment.content }}
				</span>

				<!-- Room Mention segment -->
				<span
					v-else-if="segment.type === 'room' && segment.tokenId && segment.id"
					v-context-menu="
						(evt: any) =>
							openMenu(evt, [{ label: t('menu.join_room'), icon: 'chats-circle', onClick: () => joinIfMember(segment.tokenId!, segment.id!) }])
					"
					class="no-callout relative select-none"
					@click="joinIfMember(segment.tokenId, segment.id)"
				>
					<span class="text-accent-primary cursor-pointer">{{ segment.content }}</span>
					<div v-if="activeMentionCard === segment.id && segment.tokenId">
						<RoomLoginDialog
							v-if="segment.type === 'room'"
							:dialog-open="segment.tokenId"
							message="rooms.join_sure"
							:message-values="[]"
							:secured="isSecured"
							title="rooms.join_room"
							@close="activeMentionCard = null"
						/>
					</div>
				</span>
			</P>
		</div>

		<!-- Regular Message -->
		<!-- eslint-disable vue/no-v-html -- content sanitized by eventTimeLineHandler -->
		<p
			v-else
			class="overflow-hidden text-ellipsis"
			v-html="messageContent"
		/>
		<!-- eslint-enable vue/no-v-html -->
	</div>
</template>

<script lang="ts" setup>
	// Packages
	import { computed, ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import Icon from '@hub-client/components/elements/Icon.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';

	//Logic
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	// New design
	import { useContextMenu } from '@hub-client/new-design/composables/contextMenu.composable';

	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();
	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const roomsStore = useRooms();
	const userStore = useUser();
	const pubhubs = usePubhubsStore();
	const activeMentionCard = ref<string | null>(null);
	const isSecured = ref<boolean>(false);
	const mentionComposable = useMentionsDisplay();

	// Regular message content (for non-deleted, non-mention messages)
	const messageContent = computed(() => {
		const content = props.event.content as Record<string, unknown>;
		return content.ph_body ?? content.formatted_body ?? content.body ?? '';
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

	async function joinIfMember(roomId: string, segmentId: string) {
		const userId = userStore.userId;
		if (userId) {
			const userIsMember = await pubhubs.isUserRoomMember(userId, roomId);
			if (userIsMember) {
				await router.push({ name: 'room', params: { id: roomId } });
			} else {
				activeMentionCard.value = segmentId;
				await roomsStore.fetchPublicRooms();
				isSecured.value = roomsStore.publicRoomIsSecure(roomId);
			}
		}
	}
</script>
