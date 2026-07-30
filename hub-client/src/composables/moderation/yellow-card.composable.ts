// Packages
import { type MatrixEvent, RoomEvent } from 'matrix-js-sdk';
import { computed, onScopeDispose, reactive, ref, watch } from 'vue';

import { type useModerationBase } from '@hub-client/composables/moderation/base.composable';

import { PubHubsStateEventType } from '@hub-client/logic/core/events';

import { MatrixEventType } from '@hub-client/models/constants';
import { type TYellowCardEntry, type TYellowCardEventContent, type TYellowCardStateEvent } from '@hub-client/models/events/TYellowCardEvent';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useUser } from '@hub-client/stores/user';

// Types
type TYellowCardInfo = {
	userId: string;
	reason: string;
	issued_by: string;
	issued_at: number;
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

	// Refs

	// `issued_at` of the warning the current user accepted in the current room, mirrored from room
	// account data because the matrix-js-sdk does not expose account data reactively.
	const acceptedIssuedAt = ref<number | undefined>(undefined);

	// Computed
	const yellowCardStateEvent = computed((): TYellowCardStateEvent | undefined => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return undefined;
		return currentRoom.getStateYellowCard();
	});

	const activeYellowCards = computed((): TYellowCardInfo[] => {
		const event = yellowCardStateEvent.value;
		if (!event?.content?.warnings) return [];

		return Object.entries(event.content.warnings).map(([userId, entry]) => ({
			userId,
			reason: entry.reason,
			issued_by: entry.issued_by,
			issued_at: entry.issued_at,
		}));
	});

	const currentUserYellowCardInfo = computed((): TYellowCardInfo | undefined => {
		const userId = userStore.user?.userId;
		if (!userId) return undefined;
		return activeYellowCards.value.find((w) => w.userId === userId);
	});

	// A warning keeps nagging the user until they accept that exact warning; a warning issued
	// afterwards has a later `issued_at` and therefore surfaces again.
	const isCurrentUserWarned = computed((): boolean => {
		const info = currentUserYellowCardInfo.value;
		if (!info) return false;
		return acceptedIssuedAt.value !== info.issued_at;
	});

	// Functions
	const getCurrentYellowCards = (): Record<string, TYellowCardEntry> => {
		return yellowCardStateEvent.value?.content?.warnings ?? {};
	};

	const sendYellowCards = async (roomId: string, warnings: Record<string, TYellowCardEntry>): Promise<void> => {
		const content: TYellowCardEventContent = { warnings };
		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs state event type
		await pubhubsStore.client.sendStateEvent(roomId, PubHubsStateEventType.YellowCard as any, content, '');
	};

	/**
	 * Read the current user's acceptance for the room in view out of room account data.
	 * Local lookup only: sliding sync keeps the room's account data in memory.
	 */
	const syncAcceptedFromAccountData = (): void => {
		acceptedIssuedAt.value = getCurrentRoom()?.getAcceptedYellowCard()?.issued_at;
	};

	/**
	 * RoomEvent.AccountData fires for every account data type in the room (read markers, tags),
	 * so ignore everything but ours instead of re-reading on unrelated traffic.
	 */
	const onRoomAccountData = (event: MatrixEvent): void => {
		if (event.getType() !== MatrixEventType.YellowCardAccepted) return;
		syncAcceptedFromAccountData();
	};

	/**
	 * Issue a warning. Requires steward power: the hub rejects `pubhubs.yellow_card` from anyone
	 * below that level, so a member cannot warn others or clear their own warning.
	 */
	const issueYellowCard = async (roomId: string, userId: string, reason: string): Promise<void> => {
		const warnings = { ...getCurrentYellowCards() };

		warnings[userId] = {
			reason,
			issued_by: userStore.user?.userId ?? '',
			issued_at: Date.now(),
		};

		await sendYellowCards(roomId, warnings);
	};

	/**
	 * Steward action: withdraw a member's warning, removing them from the sanctioned members list.
	 */
	const revokeYellowCard = async (roomId: string, userId: string): Promise<void> => {
		const warnings = { ...getCurrentYellowCards() };
		if (!warnings[userId]) return;

		delete warnings[userId];

		await sendYellowCards(roomId, warnings);
	};

	/**
	 * Acknowledge one's own warning. Stored in the user's own room account data instead of in the
	 * warning state event, so accepting needs no write access to the sanction itself.
	 */
	const acceptYellowCard = async (roomId: string): Promise<void> => {
		const info = currentUserYellowCardInfo.value;
		if (!info) return;

		// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Custom PubHubs room account data type
		await pubhubsStore.client.setRoomAccountData(roomId, MatrixEventType.YellowCardAccepted as any, { issued_at: info.issued_at });
		acceptedIssuedAt.value = info.issued_at;
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

	// Watchers

	// Follow the room in view, and keep listening for account data arriving over sync: the initial
	// sync may land after this composable is created, and acceptance can happen in another session.
	let unsubscribe: (() => void) | undefined;

	watch(
		() => getCurrentRoom()?.roomId,
		() => {
			unsubscribe?.();
			unsubscribe = undefined;

			syncAcceptedFromAccountData();

			const matrixRoom = getCurrentRoom()?.matrixRoom;
			if (!matrixRoom) return;

			matrixRoom.on(RoomEvent.AccountData, onRoomAccountData);
			unsubscribe = () => matrixRoom.off(RoomEvent.AccountData, onRoomAccountData);
		},
		{ immediate: true },
	);

	onScopeDispose(() => unsubscribe?.());

	return {
		// Reactive state
		yellowCardDialog,
		// Computed
		activeYellowCards,
		isCurrentUserWarned,
		currentUserYellowCardInfo,
		// Functions
		issueYellowCard,
		revokeYellowCard,
		acceptYellowCard,
		isUserWarned,
		getYellowCardInfo,
		openYellowCardDialog,
		onYellowCardDialogSubmit,
	};
}

export { TYellowCardInfo, useModerationYellowCard };
