import { Direction, EventType, Filter, type IRoomEvent, KnownMembership } from 'matrix-js-sdk';
import { computed, reactive, ref, watch } from 'vue';

import { useSidebar } from '@hub-client/composables/useSidebar';

import { PubHubsMgType, PubHubsStateEventType } from '@hub-client/logic/core/events';

import { type TTimeoutEntry, type TTimeoutEventContent, type TTimeoutStateEvent } from '@hub-client/models/events/TTimeoutEvent';
import { type TYellowCardEntry, type TYellowCardEventContent, type TYellowCardStateEvent } from '@hub-client/models/events/TYellowCardEvent';
import { type RoomMemberStateEvent } from '@hub-client/models/rooms/RoomMember';
import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { useMessageActions } from '@hub-client/stores/message-actions';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { type Room, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Types
type TPowerUser = {
	userId: string;
	roomId: string;
	powerLevel: number;
	displayName: string;
};

enum StewardInvitationStatus {
	Disclosed = 'disclosed',
	Pending = 'pending',
}

type TStewardInvitation = {
	userId: string;
	displayName: string;
	status: StewardInvitationStatus.Disclosed | StewardInvitationStatus.Pending;
	attributes: Array<{ id: string; rawvalue: string }> | null;
	roomId: string;
	disclosureRoomId: string;
	disclosedEventId?: string;
	requestEventId: string;
};

type TTimeoutInfo = {
	userId: string;
	timeout_until: number;
	reason: string;
	issued_by: string;
	issued_at: number;
};

type TYellowCardInfo = {
	userId: string;
	reason: string;
	issued_by: string;
	issued_at: number;
	dismissed: boolean;
};

function useModeration(room?: Room) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const roomStore = useRooms();
	const sidebar = useSidebar();
	const messageActionsStore = useMessageActions();

	// Constants
	const currentAdministrator = userStore.administrator;
	const getCurrentRoom = () => room ?? roomStore.currentRoom;

	// Reactive state
	const cardDialog = reactive<{
		visible: boolean;
		type: 'yellow' | 'red';
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		type: 'yellow',
		roomId: '',
		memberId: '',
	});

	const hideMessageDialog = reactive<{
		visible: boolean;
		roomId: string;
		eventId: string;
	}>({
		visible: false,
		roomId: '',
		eventId: '',
	});

	const timeoutDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	const kickDialog = reactive<{
		visible: boolean;
		roomId: string;
		memberId: string;
	}>({
		visible: false,
		roomId: '',
		memberId: '',
	});

	// Refs
	const stewardInvitations = ref<TStewardInvitation[]>([]);
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

	const allMembers = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return currentRoom
			.getStateJoinedMembers()
			.filter((m) => !m.state_key.startsWith('@notices_user:'))
			.map((m) => m.sender);
	});

	const allOtherMembers = computed(() => allMembers.value.filter((userId) => userId !== userStore.userId));

	const powerMembers = computed((): TPowerUser[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];

		const state = currentRoom.getStatePowerLevel();
		if (!state) return [];

		return Object.entries(state.content.users as Record<string, number>).reduce((acc, [userId, powerLevel]) => {
			if (userId.startsWith('@notices_user:')) return acc;

			const user: TPowerUser = {
				userId,
				roomId: currentRoom.roomId,
				powerLevel,
				displayName: userStore.userDisplayName(userId) ?? userId,
			};

			if (powerLevel >= UserPowerLevel.Steward && allMembers.value.includes(user.userId)) acc.push(user);

			return acc;
		}, [] as TPowerUser[]);
	});

	const nonPowerMemberIds = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		if (currentRoom.isDirectMessageRoom()) return [...new Set(allMembers.value)];

		const powerUserIds = powerMembers.value.map((user) => user.userId);

		return allMembers.value.filter((id) => !powerUserIds.includes(id));
	});

	const stewards = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Steward));

	const admins = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Admin));

	const membershipEvents = computed((): RoomMemberStateEvent[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return currentRoom.getStateMember();
	});

	// Yellow Card State Event (new system)
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

	const numberOfSanctionedMembers = computed(
		() => redCardMembers.value.length + activeYellowCards.value.length + revokedRedCardMembers.value.length + activeTimeouts.value.length,
	);

	const canWhisperFromContextMenu = computed(() => {
		const currentUserId = userStore.user?.userId;
		const currentRoom = roomStore.currentRoom;
		if (!currentUserId || !currentRoom) return false;
		const currentUserPowerLevel = currentRoom.getPowerLevel(currentUserId);
		return currentUserPowerLevel >= UserPowerLevel.Steward;
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

	const fetchStewardInvitations = async () => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return;

		const roomMembers = currentRoom.getMembersIds();
		const stewardIds = stewards.value.map((steward) => steward.userId);

		const filteredRooms = roomStore
			.fetchRoomList(DirectRooms)
			.filter((room) => room.roomType === RoomType.PH_MESSAGES_DM)
			.filter((room) => {
				const powerLevelsEvent = room.stateEvents.find((e) => e.type === EventType.RoomPowerLevels);
				const users = Object.keys(powerLevelsEvent?.content.users || {}).filter((user) => user !== userStore.user.userId);
				return users.some((user) => roomMembers.includes(user) && !stewardIds.includes(user));
			});

		const eventFilter = new Filter(undefined);
		eventFilter.setDefinition({
			room: { timeline: { limit: 50, types: [EventType.RoomMessage] } },
		});

		const eventPromises = filteredRooms.map(async (room) => {
			const events = await pubhubsStore.client.createMessagesRequest(room.roomId, null, 50, Direction.Backward, eventFilter);
			if (!events) return null;

			const latestRequest = events.chunk.findLast(
				(e: IRoomEvent) =>
					e.content.msgtype === PubHubsMgType.AskDisclosureMessage && e.content.ask_disclosure_message.replyToRoomId === currentRoom.roomId,
			);
			if (!latestRequest) return null;

			const userId = latestRequest.content.ask_disclosure_message.userId;
			const userDisclosedMessage = events.chunk.findLast((e: IRoomEvent) => e.content.msgtype === PubHubsMgType.DisclosedMessage && e.sender === userId);
			const attributes =
				userDisclosedMessage?.content.signed_message.disclosed
					.flat()
					.map((a: { id: string; rawvalue: string }) => ({ id: a.id, rawvalue: a.rawvalue })) ?? null;

			return {
				userId,
				displayName: userStore.userDisplayName(userId) ?? userId,
				status: userDisclosedMessage ? StewardInvitationStatus.Disclosed : StewardInvitationStatus.Pending,
				attributes,
				roomId: latestRequest.content.ask_disclosure_message.replyToRoomId,
				disclosureRoomId: room.roomId,
				disclosedEventId: userDisclosedMessage?.event_id,
				requestEventId: latestRequest.event_id,
			};
		});

		stewardInvitations.value = (await Promise.all(eventPromises)).filter(Boolean) as TStewardInvitation[];
	};

	const promoteToSteward = (userId: string, roomId: string) => {
		if (!currentAdministrator) return;
		currentAdministrator.changePermission(userId, roomId, UserPowerLevel.Steward);
	};

	const demoteToNonPowerMember = (userId: string, roomId: string) => {
		if (!currentAdministrator) return;
		currentAdministrator.changePermission(userId, roomId, UserPowerLevel.User);
	};

	const contactSteward = () => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		const stewardIds = stewards.value.map((steward) => steward.userId);
		roomStore.createStewardRoomOrModify(currentRoom.roomId, stewardIds);
	};

	const onPromoteToSteward = async (stewardInvite: TStewardInvitation) => {
		promoteToSteward(stewardInvite.userId, stewardInvite.roomId);
		removeStewardInvite(stewardInvite);
	};

	const removeStewardInvite = (stewardInvite: TStewardInvitation) => {
		stewardInvitations.value = stewardInvitations.value.filter((u) => u.userId !== stewardInvite.userId || u.roomId !== stewardInvite.roomId);
		pubhubsStore.client.redactEvent(stewardInvite.disclosureRoomId, stewardInvite.requestEventId);
		if (stewardInvite.disclosedEventId) {
			pubhubsStore.client.redactEvent(stewardInvite.disclosureRoomId, stewardInvite.disclosedEventId);
		}
	};

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

	// Yellow Card Functions (new state event system)
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

	const issueRedCard = (roomId: string, userId: string, reason: string) => pubhubsStore.client.ban(roomId, userId, reason);

	const revokeRedCard = (roomId: string, userId: string) => pubhubsStore.client.unban(roomId, userId);

	const hideMessage = (roomId: string, targetEventId: string, label: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, true, label);

	const unHideMessage = (roomId: string, targetEventId: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, false);

	const stewardSourceRoomName = (room: Room): string => {
		if (room.getType() !== RoomType.PH_MESSAGE_STEWARD_CONTACT) return '';
		const sourceRoomId = room.name.split(',')[0];
		return roomStore.roomList.find((r) => r.roomId === sourceRoomId)?.name ?? roomStore.fetchRoomById(sourceRoomId)?.name ?? '';
	};

	const startWhisperToMember = (userId: string) => {
		if (sidebar.isMobile.value) sidebar.close();
		messageActionsStore.replyingTo = undefined;
		messageActionsStore.whisperingToUserId = userId;
		messageActionsStore.whisperingToDisplayName = userStore.userDisplayName(userId);
		messageActionsStore.whisperingToEventId = undefined;
	};

	const openCardDialog = (type: 'yellow' | 'red', roomId: string, memberId: string) => {
		cardDialog.type = type;
		cardDialog.roomId = roomId;
		cardDialog.memberId = memberId;
		cardDialog.visible = true;
	};

	const onCardDialogSubmit = async (reason: string) => {
		if (cardDialog.type === 'yellow') {
			await issueYellowCard(cardDialog.roomId, cardDialog.memberId, reason);
		} else {
			issueRedCard(cardDialog.roomId, cardDialog.memberId, reason);
		}
	};

	const openHideMessageDialog = (roomId: string, eventId: string) => {
		hideMessageDialog.roomId = roomId;
		hideMessageDialog.eventId = eventId;
		hideMessageDialog.visible = true;
	};

	const onHideMessageDialogSubmit = (label: string) => {
		hideMessage(hideMessageDialog.roomId, hideMessageDialog.eventId, label);
	};

	// Watchers
	const watchStewardInvites = () =>
		watch(
			() => roomStore.currentRoom,
			() => {
				fetchStewardInvitations();
			},
			{ immediate: true },
		);

	return {
		// Reactive state
		cardDialog,
		hideMessageDialog,
		timeoutDialog,
		kickDialog,
		// Refs
		stewardInvitations,
		// Computed
		activeTimeouts,
		isCurrentUserTimedOut,
		currentUserTimeoutInfo,
		activeYellowCards,
		isCurrentUserWarned,
		currentUserYellowCardInfo,
		allMembers,
		allOtherMembers,
		nonPowerMemberIds,
		powerMembers,
		stewards,
		admins,
		membershipEvents,
		redCardMembers,
		revokedRedCardMembers,
		numberOfSanctionedMembers,
		canWhisperFromContextMenu,
		// Functions
		refreshTimeoutStatus,
		isUserTimedOut,
		getTimeoutInfo,
		canTimeoutUser,
		issueTimeout,
		revokeTimeout,
		openTimeoutDialog,
		onTimeoutDialogSubmit,
		isUserWarned,
		getYellowCardInfo,
		dismissYellowCard,
		fetchStewardInvitations,
		promoteToSteward,
		demoteToNonPowerMember,
		contactSteward,
		onPromoteToSteward,
		removeStewardInvite,
		removeMember,
		openKickDialog,
		onKickDialogSubmit,
		issueYellowCard,
		issueRedCard,
		revokeRedCard,
		hideMessage,
		unHideMessage,
		stewardSourceRoomName,
		startWhisperToMember,
		openCardDialog,
		onCardDialogSubmit,
		openHideMessageDialog,
		onHideMessageDialogSubmit,
		watchStewardInvites,
	};
}

export { TPowerUser, TTimeoutInfo, TYellowCardInfo, StewardInvitationStatus, TStewardInvitation, useModeration };
