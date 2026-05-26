import { KnownMembership } from 'matrix-js-sdk';
import { computed, reactive } from 'vue';

import { type useModerationBase } from '@hub-client/composables/moderation/base.composable';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

function useModerationRedCard(base: ReturnType<typeof useModerationBase>) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const { membershipEvents } = base;

	// Reactive state
	const redCardDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	// Computed
	const redCardMembers = computed(() =>
		membershipEvents.value
			.filter((event) => event.content.membership === KnownMembership.Ban)
			.map((event) => {
				return { userId: event.state_key, reason: event.content.reason };
			}),
	);

	const revokedRedCardMembers = computed(() =>
		membershipEvents.value
			.filter((event) => event.unsigned.prev_content?.membership === KnownMembership.Ban)
			.map((event) => {
				return { userId: event.state_key, reason: event.content.reason };
			}),
	);

	// Functions
	const issueRedCard = (roomId: string, userId: string, reason: string) => pubhubsStore.client.ban(roomId, userId, reason);

	const revokeRedCard = (roomId: string, userId: string) => pubhubsStore.client.unban(roomId, userId);

	const openRedCardDialog = (roomId: string, memberId: string) => {
		redCardDialog.roomId = roomId;
		redCardDialog.memberId = memberId;
		redCardDialog.visible = true;
	};

	const onRedCardDialogSubmit = (reason: string) => {
		issueRedCard(redCardDialog.roomId, redCardDialog.memberId, reason);
	};

	return {
		// Reactive state
		redCardDialog,
		// Computed
		redCardMembers,
		revokedRedCardMembers,
		// Functions
		issueRedCard,
		revokeRedCard,
		openRedCardDialog,
		onRedCardDialogSubmit,
	};
}

export { useModerationRedCard };
