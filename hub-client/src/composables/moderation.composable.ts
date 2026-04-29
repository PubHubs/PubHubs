import { Direction, EventType, Filter, type IRoomEvent, KnownMembership } from 'matrix-js-sdk';
import { computed, reactive, ref, watch } from 'vue';

import { useSidebar } from '@hub-client/composables/useSidebar';

import { PubHubsMgType } from '@hub-client/logic/core/events';

import { type RoomMemberStateEvent } from '@hub-client/models/rooms/RoomMember';
import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { useMessageActions } from '@hub-client/stores/message-actions';
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { type Room, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

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

function useModeration(room?: Room) {
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const roomStore = useRooms();
	const sidebar = useSidebar();
	const messageActionsStore = useMessageActions();
	const currentAdministrator = userStore.administrator;
	const stewardInvitations = ref<TStewardInvitation[]>([]);

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

	const allMembers = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return currentRoom
			.getStateJoinedMembers()
			.filter((m) => !m.state_key.startsWith('@notices_user:'))
			.map((m) => m.sender);
	});

	const allOtherMembers = computed(() => allMembers.value.filter((userId) => userId !== userStore.userId));

	const nonPowerMemberIds = computed(() => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		if (currentRoom.isDirectMessageRoom()) return [...new Set(allMembers.value)];

		const powerUserIds = powerMembers.value.map((user) => user.userId);

		return allMembers.value.filter((id) => !powerUserIds.includes(id));
	});

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

	const stewards = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Steward));

	const admins = computed(() => powerMembers.value.filter((user) => user.powerLevel === UserPowerLevel.Admin));

	const membershipEvents = computed((): RoomMemberStateEvent[] => {
		const currentRoom = getCurrentRoom();
		if (!currentRoom) return [];
		return currentRoom.getStateMember();
	});

	const yellowCardMembers = computed(() =>
		membershipEvents.value
			.filter(
				(event) =>
					(event.content.membership === KnownMembership.Leave || event.unsigned.prev_content?.membership === KnownMembership.Leave) &&
					(event.content.reason || event.unsigned.prev_content?.reason) &&
					(event.sender !== event.state_key || event.sender !== event.unsigned.prev_sender) &&
					event.content.membership !== KnownMembership.Ban &&
					event.unsigned.prev_content?.membership !== KnownMembership.Ban,
			)
			.map((event) => {
				return { userId: event.state_key, reason: event.content.reason ?? event.unsigned.prev_content?.reason };
			}),
	);

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

	const hasSanctionedMembers = computed(
		() => redCardMembers.value?.length > 0 || yellowCardMembers.value?.length > 0 || revokedRedCardMembers.value?.length > 0,
	);

	const canWhisperFromContextMenu = computed(() => {
		const currentUserId = userStore.user?.userId;
		const currentRoom = roomStore.currentRoom;
		if (!currentUserId || !currentRoom) return false;
		const currentUserPowerLevel = currentRoom.getPowerLevel(currentUserId);
		return currentUserPowerLevel >= UserPowerLevel.Steward;
	});

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

	const removeMember = (roomId: string, userId: string) => pubhubsStore.client.kick(roomId, userId);

	const issueYellowCard = (roomId: string, userId: string, reason: string) => pubhubsStore.client.kick(roomId, userId, reason);

	const issueRedCard = (roomId: string, userId: string, reason: string) => pubhubsStore.client.ban(roomId, userId, reason);

	const revokeRedCard = (roomId: string, userId: string) => pubhubsStore.client.unban(roomId, userId);

	const hideMessage = (roomId: string, targetEventId: string, label: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, true, label);

	const unHideMessage = (roomId: string, targetEventId: string) => pubhubsStore.addVisibilityMessage(roomId, targetEventId, false);

	const getCurrentRoom = () => room ?? roomStore.currentRoom;

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

	const onCardDialogSubmit = (reason: string) => {
		if (cardDialog.type === 'yellow') {
			issueYellowCard(cardDialog.roomId, cardDialog.memberId, reason);
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

	const watchStewardInvites = () =>
		watch(
			() => roomStore.currentRoom,
			() => {
				fetchStewardInvitations();
			},
			{ immediate: true },
		);

	return {
		cardDialog,
		hideMessageDialog,
		allMembers,
		allOtherMembers,
		stewardInvitations,
		nonPowerMemberIds,
		powerMembers,
		stewards,
		admins,
		yellowCardMembers,
		redCardMembers,
		revokedRedCardMembers,
		hasSanctionedMembers,
		canWhisperFromContextMenu,
		membershipEvents,
		startWhisperToMember,
		promoteToSteward,
		demoteToNonPowerMember,
		contactSteward,
		onPromoteToSteward,
		removeStewardInvite,
		stewardSourceRoomName,
		watchStewardInvites,
		removeMember,
		issueYellowCard,
		issueRedCard,
		revokeRedCard,
		openCardDialog,
		onCardDialogSubmit,
		openHideMessageDialog,
		onHideMessageDialogSubmit,
		hideMessage,
		unHideMessage,
	};
}
export { TPowerUser, StewardInvitationStatus, TStewardInvitation, useModeration };
