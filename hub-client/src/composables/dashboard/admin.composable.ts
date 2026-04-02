import { Direction, EventType, IRoomEvent } from 'matrix-js-sdk';
import { ref } from 'vue';

import { PubHubsMgType } from '@hub-client/logic/core/events';

import { DirectRooms, RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { UserPowerLevel } from '@hub-client/models/users/TUser';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

export type StewardDetails = {
	userId: string;
	roomId: string;
	powerLevel: number;
	displayName: string;
};

export type StewardInvitation = {
	userId: string;
	displayName: string;
	status: 'disclosed' | 'pending';
	attributes: Array<{ id: string; rawvalue: string }> | null;
	roomId: string;
	disclosureRoomId: string;
	disclosedEventId?: string;
	requestEventId: string;
};

export function useAdminDashboard() {
	const pubhubsStore = usePubhubsStore();
	const userStore = useUser();
	const roomStore = useRooms();

	const currentAdministrator = userStore.administrator!;
	const stewardList = ref<StewardDetails[]>([]);
	const stewardInvitations = ref<StewardInvitation[]>([]);
	const isLoading = ref(false);

	const getStewardsInRoom = (): StewardDetails[] | undefined => {
		const currentRoom = roomStore.currentRoom;
		if (!currentRoom) return;

		const state = currentRoom.getStatePowerLevel();
		if (!state) return;

		const stewards = Object.entries(state.content.users as Record<string, number>)
			.filter(([userId, powerLevel]) => {
				return powerLevel >= UserPowerLevel.Steward && powerLevel < UserPowerLevel.Admin && !userId.includes('@notices');
			})
			.map(([userId, powerLevel]) => ({
				userId,
				roomId: currentRoom.roomId,
				powerLevel,
				displayName: userStore.userDisplayName(userId) ?? userId,
			}));

		stewardList.value = stewards;
		return stewards;
	};

	const fetchStewardInvitations = async (stewards: StewardDetails[] = []) => {
		isLoading.value = true;
		try {
			const currentRoom = roomStore.currentRoom;
			if (!currentRoom) return;

			const roomMembers = currentRoom.getMembersIds();
			const stewardIds = stewards.map((s) => s.userId);

			const filteredRooms = roomStore
				.fetchRoomList(DirectRooms)
				// disclosureRequests are only sent in (1 on 1) direct message rooms
				.filter((room) => room.roomType === RoomType.PH_MESSAGES_DM)
				// filter out rooms where the other user is a steward or the other user is not a member of the current room
				.filter((room) => {
					const powerLevelsEvent = room.stateEvents.find((e) => e.type === EventType.RoomPowerLevels);

					const users = Object.keys(powerLevelsEvent?.content.users || {}).filter((user) => user !== userStore.user.userId);

					return users.some((user) => roomMembers.includes(user) && !stewardIds.includes(user));
				});

			if (!filteredRooms) return;

			const invitations: StewardInvitation[] = [];

			const eventPromises = filteredRooms.map((room) =>
				pubhubsStore.client.createMessagesRequest(room.roomId, null, 50, Direction.Backward).then(async (events) => {
					if (!events) return;

					// Find the most recent disclosureRequest
					const latestRequest = events.chunk.findLast((e: IRoomEvent) => e.content.msgtype === PubHubsMgType.AskDisclosureMessage && e.content.ask_disclosure_message.replyToRoomId === currentRoom.roomId);

					if (latestRequest) {
						const userId = latestRequest.content.ask_disclosure_message.userId;

						// Find the  most recent disclosed message
						const userDisclosedMessage = events.chunk.findLast((e: IRoomEvent) => e.content.msgtype === PubHubsMgType.DisclosedMessage && e.sender === userId);

						const attributes = userDisclosedMessage
							? userDisclosedMessage.content.signed_message.disclosed.flat().map((a: any) => ({
									id: a.id,
									rawvalue: a.rawvalue,
								}))
							: null;

						invitations.push({
							userId,
							displayName: userStore.userDisplayName(userId) ?? userId,
							status: userDisclosedMessage ? 'disclosed' : 'pending',
							attributes,
							roomId: latestRequest.content.ask_disclosure_message.replyToRoomId,
							disclosureRoomId: room.roomId,
							disclosedEventId: userDisclosedMessage?.event_id,
							requestEventId: latestRequest.event_id,
						});
					}
				}),
			);

			await Promise.all(eventPromises);

			stewardInvitations.value = invitations;
		} finally {
			isLoading.value = false;
		}
	};

	const addSteward = async (userId: string, roomId: string, displayName: string) => {
		await currentAdministrator.changePermission(userId, roomId, UserPowerLevel.Steward);
		stewardList.value.push({
			userId,
			roomId,
			powerLevel: UserPowerLevel.Steward,
			displayName,
		});
	};

	const removeSteward = async (userId: string, roomId: string) => {
		await currentAdministrator.changePermission(userId, roomId, UserPowerLevel.User);
		stewardList.value = stewardList.value.filter((u) => u.userId !== userId || u.roomId !== roomId);
	};

	const onPromote = async (stewardInvite: StewardInvitation) => {
		await addSteward(stewardInvite.userId, stewardInvite.roomId, stewardInvite.displayName);
		removeStewardInvite(stewardInvite);
	};

	const removeStewardInvite = async (stewardInvite: StewardInvitation) => {
		stewardInvitations.value = stewardInvitations.value.filter((u) => u.userId !== stewardInvite.userId || u.roomId !== stewardInvite.roomId);
		pubhubsStore.client.redactEvent(stewardInvite.disclosureRoomId, stewardInvite.requestEventId);
		if (stewardInvite.disclosedEventId) {
			pubhubsStore.client.redactEvent(stewardInvite.disclosureRoomId, stewardInvite.disclosedEventId);
		}
	};

	return {
		stewardList,
		stewardInvitations,
		isLoading,
		getStewardsInRoom,
		fetchStewardInvitations,
		addSteward,
		removeSteward,
		onPromote,
		removeStewardInvite,
	};
}
