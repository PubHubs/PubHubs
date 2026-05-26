import { reactive } from 'vue';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

function useModerationKick() {
	// Stores
	const pubhubsStore = usePubhubsStore();

	// Reactive state
	const kickDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	// Functions
	const removeMember = (roomId: string, userId: string, reason: string) => pubhubsStore.client.kick(roomId, userId, reason);

	const openKickDialog = (roomId: string, memberId: string) => {
		kickDialog.roomId = roomId;
		kickDialog.memberId = memberId;
		kickDialog.visible = true;
	};

	const onKickDialogSubmit = (reason: string) => {
		removeMember(kickDialog.roomId, kickDialog.memberId, reason);
		kickDialog.visible = false;
	};

	return {
		// Reactive state
		kickDialog,
		// Functions
		removeMember,
		openKickDialog,
		onKickDialogSubmit,
	};
}

export { useModerationKick };
