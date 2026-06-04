import { computed, reactive } from 'vue';

import { type useModerationBase } from '@hub-client/composables/moderation/base.composable';

import { PubHubsStateEventType } from '@hub-client/logic/core/events';

import { type TYellowCardEntry, type TYellowCardEventContent, type TYellowCardStateEvent } from '@hub-client/models/events/TYellowCardEvent';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useUser } from '@hub-client/stores/user';

// Types
type TYellowCardInfo = {
	userId: string;
	reason: string;
	issued_by: string;
	issued_at: number;
	dismissed: boolean;
};

function useModerationYellowCard(base: ReturnType<typeof useModerationBase>) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const { getCurrentRoom } = base;

	// Reactive state
	const yellowCardDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	// Computed
	const yellowCardStateEvent = computed((): TYellowCardStateEvent | undefined => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return undefined;
		return currentRoom.getStateYellowCard();
	});

	const activeYellowCards = computed((): TYellowCardInfo[] => {
		const event = yellowCardStateEvent.value;
		if (!event?.content?.warnings) return [];

		return Object.entries(event.content.warnings)
			.filter(([, entry]) => !entry.dismissed)
			.map(([userId, entry]) => ({
				userId,
				reason: entry.reason,
				issued_by: entry.issued_by,
				issued_at: entry.issued_at,
				dismissed: entry.dismissed,
			}));
	});

	const isCurrentUserWarned = computed((): boolean => {
		const userId = userStore.user?.userId;
		if (!userId) return false;
		return activeYellowCards.value.some((w) => w.userId === userId);
	});

	const currentUserYellowCardInfo = computed((): TYellowCardInfo | undefined => {
		const userId = userStore.user?.userId;
		if (!userId) return undefined;
		return activeYellowCards.value.find((w) => w.userId === userId);
	});

	// Functions
	const getCurrentYellowCards = (): Record<string, TYellowCardEntry> => {
		return yellowCardStateEvent.value?.content?.warnings ?? {};
	};

	const issueYellowCard = async (roomId: string, userId: string, reason: string): Promise<void> => {
		// Initialize power levels for yellow card event if needed
		await pubhubsStore.initialiseYellowCardPowerLevels(roomId);

		const now = Date.now();
		const currentWarnings = { ...getCurrentYellowCards() };

		currentWarnings[userId] = {
			reason,
			issued_by: userStore.user?.userId ?? '',
			issued_at: now,
			dismissed: false,
		};

		const content: TYellowCardEventContent = {
			warnings: currentWarnings,
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs state event type
		await pubhubsStore.client.sendStateEvent(roomId, PubHubsStateEventType.YellowCard as any, content, '');
	};

	const dismissYellowCard = async (roomId: string): Promise<void> => {
		const userId = userStore.user?.userId;
		if (!userId) return;

		const currentWarnings = { ...getCurrentYellowCards() };

		// Only allow dismissing own warning
		if (currentWarnings[userId]) {
			currentWarnings[userId] = {
				...currentWarnings[userId],
				dismissed: true,
			};
		} else {
			return;
		}

		const content: TYellowCardEventContent = {
			warnings: currentWarnings,
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs state event type
		await pubhubsStore.client.sendStateEvent(roomId, PubHubsStateEventType.YellowCard as any, content, '');
	};

	const isUserWarned = (userId: string): boolean => {
		return activeYellowCards.value.some((w) => w.userId === userId);
	};

	const getYellowCardInfo = (userId: string): TYellowCardInfo | undefined => {
		return activeYellowCards.value.find((w) => w.userId === userId);
	};

	const openYellowCardDialog = (roomId: string, memberId: string) => {
		yellowCardDialog.roomId = roomId;
		yellowCardDialog.memberId = memberId;
		yellowCardDialog.visible = true;
	};

	const onYellowCardDialogSubmit = async (reason: string) => {
		await issueYellowCard(yellowCardDialog.roomId, yellowCardDialog.memberId, reason);
	};

	return {
		// Reactive state
		yellowCardDialog,
		// Computed
		activeYellowCards,
		isCurrentUserWarned,
		currentUserYellowCardInfo,
		// Functions
		issueYellowCard,
		dismissYellowCard,
		isUserWarned,
		getYellowCardInfo,
		openYellowCardDialog,
		onYellowCardDialogSubmit,
	};
}

export { TYellowCardInfo, useModerationYellowCard };
