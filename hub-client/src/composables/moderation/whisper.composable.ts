import { computed } from 'vue';

import { useSidebar } from '@hub-client/composables/useSidebar';

import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { useMessageActions } from '@hub-client/stores/message-actions';
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

function useModerationWhisper() {
	// Stores
	const userStore = useUser();
	const roomStore = useRooms();
	const sidebar = useSidebar();
	const messageActionsStore = useMessageActions();

	// Computed
	const canWhisperFromContextMenu = computed(() => {
		const currentUserId = userStore.user?.userId;
		const currentRoom = roomStore.currentRoom;
		if (!currentUserId || !currentRoom) return false;
		const currentUserPowerLevel = currentRoom.getPowerLevel(currentUserId);
		return currentUserPowerLevel >= UserPowerLevel.Steward;
	});

	// Functions
	const startWhisperToMember = (userId: string) => {
		if (sidebar.isMobile.value) sidebar.close();
		messageActionsStore.replyingTo = undefined;
		messageActionsStore.whisperingToUserId = userId;
		messageActionsStore.whisperingToDisplayName = userStore.userDisplayName(userId);
		messageActionsStore.whisperingToEventId = undefined;
	};

	return {
		// Computed
		canWhisperFromContextMenu,
		// Functions
		startWhisperToMember,
	};
}

export { useModerationWhisper };
