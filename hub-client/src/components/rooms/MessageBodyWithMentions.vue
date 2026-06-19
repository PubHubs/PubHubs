<template>
	<span class="overflow-hidden text-ellipsis">
		<template v-if="hasAnyMentions">
			<span
				v-for="(segment, index) in messageSegments"
				:key="index"
				class="inline"
			>
				<!-- Normal text segment -->
				<!-- eslint-disable vue/no-v-html -- content escaped by textToHtml -->
				<span
					v-if="segment.type === 'text'"
					v-html="textToHtml(segment.content ?? '')"
				></span>
				<!-- eslint-enable vue/no-v-html -->

				<!-- User Mention segment -->
				<span
					v-else-if="segment.type === 'user' && segment.tokenId"
					v-context-menu="
						(evt: any) =>
							openMenu(evt, [{ label: t('menu.direct_message'), icon: 'chat-circle', onClick: () => userStore.goToUserRoom(segment.tokenId!) }])
					"
					class="no-callout text-accent-primary cursor-pointer select-none"
					@click.once="userStore.goToUserRoom(segment.tokenId)"
					>{{ segment.content }}</span
				>

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
					<RoomLoginDialog
						v-if="activeMentionCard === segment.id"
						:dialog-open="segment.tokenId"
						message="rooms.join_sure"
						:message-values="[]"
						:secured="isSecured"
						title="rooms.join_room"
						@close="activeMentionCard = null"
						@confirm="handleRoomJoinConfirm(segment.tokenId)"
					/>
				</span>
			</span>
		</template>
		<!-- eslint-disable vue/no-v-html -- content sanitized by useMessageBody -->
		<span
			v-else
			v-html="sanitizedBody"
		></span>
		<!-- eslint-enable vue/no-v-html -->
	</span>
</template>

<script setup lang="ts">
	// Packages
	import { ref } from 'vue';
	import { useI18n } from 'vue-i18n';

	// Components
	import RoomLoginDialog from '@hub-client/components/ui/RoomLoginDialog.vue';

	// Composables
	import { useContextMenu } from '@hub-client/composables/contextMenu.composable';
	import { useMessageBody } from '@hub-client/composables/message-body.composable';

	// Logic
	import { router } from '@hub-client/logic/core/router';
	import { textToHtml } from '@hub-client/logic/core/sanitizer';

	// Stores
	import { usePubhubsStore } from '@hub-client/stores/pubhubs';
	import { useRooms } from '@hub-client/stores/rooms';
	import { useUser } from '@hub-client/stores/user';

	const props = withDefaults(
		defineProps<{
			body: string | undefined;
			phBody: string | undefined;
		}>(),
		{
			body: undefined,
			phBody: undefined,
		},
	);

	const { openMenu } = useContextMenu();
	const { t } = useI18n();
	const userStore = useUser();
	const roomsStore = useRooms();
	const pubhubs = usePubhubsStore();

	const activeMentionCard = ref<string | null>(null);
	const isSecured = ref(false);

	const { messageSegments, hasAnyMentions, sanitizedBody } = useMessageBody(
		() => props.body,
		() => props.phBody,
	);

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
		const result = await pubhubs.joinRoom(roomId);
		if (result !== -1) {
			await router.push({ name: 'room', params: { id: roomId } });
		}
	}
</script>
