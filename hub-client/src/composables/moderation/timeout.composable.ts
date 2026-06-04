import { computed, reactive, ref } from 'vue';

import { type useModerationBase } from '@hub-client/composables/moderation/base.composable';

import { PubHubsStateEventType } from '@hub-client/logic/core/events';

import { type TTimeoutEntry, type TTimeoutEventContent, type TTimeoutStateEvent } from '@hub-client/models/events/TTimeoutEvent';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useUser } from '@hub-client/stores/user';

// Types
type TTimeoutInfo = {
	userId: string;
	timeout_until: number;
	reason: string;
	issued_by: string;
	issued_at: number;
};

function useModerationTimeout(base: ReturnType<typeof useModerationBase>) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const { getCurrentRoom } = base;

	// Reactive state
	const timeoutDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	// Refs
	const timeoutRecomputeTrigger = ref(0);

	// Computed
	const timeoutStateEvent = computed((): TTimeoutStateEvent | undefined => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return undefined;
		return currentRoom.getStateTimeout();
	});

	const activeTimeouts = computed((): TTimeoutInfo[] => {
		// Reference trigger to allow forced re-computation when timeout expires
		void timeoutRecomputeTrigger.value;

		const event = timeoutStateEvent.value;
		if (!event?.content?.timeouts) return [];

		const now = Date.now();
		return Object.entries(event.content.timeouts)
			.filter(([, entry]) => entry.timeout_until > now)
			.map(([userId, entry]) => ({
				userId,
				timeout_until: entry.timeout_until,
				reason: entry.reason,
				issued_by: entry.issued_by,
				issued_at: entry.issued_at,
			}));
	});

	const isCurrentUserTimedOut = computed((): boolean => {
		const userId = userStore.user?.userId;
		if (!userId) return false;
		return activeTimeouts.value.some((t) => t.userId === userId);
	});

	const currentUserTimeoutInfo = computed((): TTimeoutInfo | undefined => {
		const userId = userStore.user?.userId;
		if (!userId) return undefined;
		return activeTimeouts.value.find((t) => t.userId === userId);
	});

	// Functions
	const refreshTimeoutStatus = (): void => {
		timeoutRecomputeTrigger.value++;
	};

	const isUserTimedOut = (userId: string): boolean => {
		return activeTimeouts.value.some((t) => t.userId === userId);
	};

	const getTimeoutInfo = (userId: string): TTimeoutInfo | undefined => {
		return activeTimeouts.value.find((t) => t.userId === userId);
	};

	const canTimeoutUser = (targetUserId: string): boolean => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return false;

		const currentUserId = userStore.user?.userId;
		if (!currentUserId) return false;

		// Cannot timeout yourself
		if (currentUserId === targetUserId) return false;

		const currentUserPowerLevel = currentRoom.getPowerLevel(currentUserId);
		const targetUserPowerLevel = currentRoom.getPowerLevel(targetUserId);

		// Must be steward or higher
		if (currentUserPowerLevel < UserPowerLevel.Steward) return false;

		// Cannot timeout users with equal or higher power level
		if (targetUserPowerLevel >= currentUserPowerLevel) return false;

		return true;
	};

	const getCurrentTimeouts = (): Record<string, TTimeoutEntry> => {
		return timeoutStateEvent.value?.content?.timeouts ?? {};
	};

	const issueTimeout = async (roomId: string, userId: string, durationMinutes: number, reason: string): Promise<void> => {
		// Initialize power levels for timeout event if needed
		await pubhubsStore.initialiseTimeoutPowerLevels(roomId);

		const now = Date.now();
		const currentTimeouts = { ...getCurrentTimeouts() };

		currentTimeouts[userId] = {
			timeout_until: now + durationMinutes * 60 * 1000,
			reason,
			issued_by: userStore.user?.userId ?? '',
			issued_at: now,
		};

		const content: TTimeoutEventContent = {
			timeouts: currentTimeouts,
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs state event type
		await pubhubsStore.client.sendStateEvent(roomId, PubHubsStateEventType.Timeout as any, content, '');
	};

	const revokeTimeout = async (roomId: string, userId: string): Promise<void> => {
		const currentTimeouts = { ...getCurrentTimeouts() };

		// Set timeout_until to 0 to mark as revoked (keeping history)
		if (currentTimeouts[userId]) {
			currentTimeouts[userId] = {
				...currentTimeouts[userId],
				timeout_until: 0,
			};
		}

		const content: TTimeoutEventContent = {
			timeouts: currentTimeouts,
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs state event type
		await pubhubsStore.client.sendStateEvent(roomId, PubHubsStateEventType.Timeout as any, content, '');
	};

	const openTimeoutDialog = (roomId: string, memberId: string) => {
		timeoutDialog.roomId = roomId;
		timeoutDialog.memberId = memberId;
		timeoutDialog.visible = true;
	};

	const onTimeoutDialogSubmit = async (durationMinutes: number, reason: string) => {
		await issueTimeout(timeoutDialog.roomId, timeoutDialog.memberId, durationMinutes, reason);
		timeoutDialog.visible = false;
	};

	return {
		// Reactive state
		timeoutDialog,
		// Computed
		activeTimeouts,
		isCurrentUserTimedOut,
		currentUserTimeoutInfo,
		// Functions
		refreshTimeoutStatus,
		isUserTimedOut,
		getTimeoutInfo,
		canTimeoutUser,
		issueTimeout,
		revokeTimeout,
		openTimeoutDialog,
		onTimeoutDialogSubmit,
	};
}

export { TTimeoutInfo, useModerationTimeout };
