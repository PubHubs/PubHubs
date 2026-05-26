import { Direction, EventType, Filter, type IRoomEvent } from 'matrix-js-sdk';
import { ref, watch } from 'vue';

import { type useModerationBase } from '@hub-client/composables/moderation/base.composable';

import { PubHubsMgType } from '@hub-client/logic/core/events';

import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { type Room, useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

// Types
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

function useModerationMembership(base: ReturnType<typeof useModerationBase>) {
	// Stores
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const roomStore = useRooms();
	const { getCurrentRoom, stewards } = base;

	// Constants
	const currentAdministrator = userStore.administrator;

	// Refs
	const stewardInvitations = ref<TStewardInvitation[]>([]);

	// Functions
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

	const stewardSourceRoomName = (room: Room): string => {
		if (room.getType() !== RoomType.PH_MESSAGE_STEWARD_CONTACT) return '';
		const sourceRoomId = room.name.split(',')[0];
		return roomStore.roomList.find((r) => r.roomId === sourceRoomId)?.name ?? roomStore.fetchRoomById(sourceRoomId)?.name ?? '';
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
		// Refs
		stewardInvitations,
		// Functions
		fetchStewardInvitations,
		promoteToSteward,
		demoteToNonPowerMember,
		contactSteward,
		onPromoteToSteward,
		removeStewardInvite,
		stewardSourceRoomName,
		watchStewardInvites,
	};
}

export { StewardInvitationStatus, TStewardInvitation, useModerationMembership };
