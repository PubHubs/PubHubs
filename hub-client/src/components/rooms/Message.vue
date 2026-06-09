<template>
	<div class="flex flex-col gap-1 wrap-break-word">
		<!-- Deleted Message -->
		<template v-if="deleted">
			<div class="flex flex-row items-center gap-1">
				<Icon
					class="text-on-surface-dim"
					size="sm"
					type="trash"
				/>
				<p class="text-on-surface-dim overflow-hidden text-ellipsis">
					{{ deletedBySteward ? t('message.delete.message_removed_by_steward') : t('message.delete.message_deleted') }}
				</p>
			</div>
			<!-- Reason shown only to original poster -->
			<p
				v-if="deletedBySteward && redactionReason && (isOriginalPoster || roles.userIsStewardOrHigher(props.event.room_id))"
				class="text-on-surface-dim ml-5 overflow-hidden text-sm text-ellipsis italic"
			>
				{{ t('message.delete.reason') }}: {{ redactionReason }}
			</p>
		</template>

		<!-- Message with Mentions -->
		<div
			v-else-if="hasAnyMentions"
			class="relative max-w-[90ch] text-ellipsis"
		>
			<P
				v-for="(segment, index) in messageSegments"
				:key="index"
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
							openMenu(evt, [
								{ label: t('menu.join_room'), icon: 'chats-circle', onClick: () => handleRoomMentionClick(segment.tokenId!, segment.id!) },
							])
					"
					class="no-callout relative select-none"
					@click="handleRoomMentionClick(segment.tokenId, segment.id)"
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
							@confirm="handleRoomJoinConfirm(segment.tokenId!)"
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
	import P from '@hub-client/components/elements/P.vue';
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// New design
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	// Composables
	import { useMentionsDisplay } from '@hub-client/composables/mention-display.composable';
	import { useRoles } from '@hub-client/composables/roles.composable';

	//Logic
	import { router } from '@hub-client/logic/core/router';

	// Models
	import { Redaction } from '@hub-client/models/constants';
	import { type TMessageEvent } from '@hub-client/models/events/TMessageEvent';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = defineProps<{
		event: TMessageEvent;
		deleted: boolean;
	}>();

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const roomsStore = useRooms();
	const userStore = useUser();
	const roles = useRoles();
	const pubhubs = usePubhubsStore();
	const activeMentionCard = ref<string | null>(null);
	const isSecured = ref<boolean>(false);
	const mentionComposable = useMentionsDisplay();

	const redactedBecause = computed(() => props.event.unsigned?.redacted_because);
	const deletedBySteward = computed(() => {
		if (!redactedBecause.value) return false;
		return redactedBecause.value.sender !== props.event.sender;
	});
	const isOriginalPoster = computed(() => props.event.sender === userStore.userId);
	const redactionReason = computed(() => {
		if (!redactedBecause.value) return undefined;
		const reason = redactedBecause.value.content?.reason as string | undefined;
		if (!reason || reason === Redaction.Deleted || reason === Redaction.DeletedFromThread || reason === Redaction.DeletedFromLibrary) {
			return undefined;
		}
		return reason;
	});

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

	async function handleRoomMentionClick(roomId: string, segmentId: string) {
		const userId = userStore.userId;
		if (!userId) return;

		const userIsMember = await pubhubs.isUserRoomMember(userId, roomId);

		if (userIsMember) {
			// Already a member - just navigate
			await router.push({ name: 'room', params: { id: roomId } });
			return;
		}

		// Not a member - show confirmation dialog
		await roomsStore.fetchPublicRooms();
		isSecured.value = roomsStore.publicRoomIsSecure(roomId);
		activeMentionCard.value = segmentId;
	}

	async function handleRoomJoinConfirm(roomId: string) {
		// Called when user confirms joining a public (non-secured) room
		const result = await pubhubs.joinRoom(roomId);
		if (result !== -1) {
			await router.push({ name: 'room', params: { id: roomId } });
		}
	}
</script>
