import { usePubHubs } from '@/core/pubhubsStore';
import { APIService } from '../services/apiService';
import { EventType } from 'matrix-js-sdk';
import { TRoomCreate, TState } from '@/model/events/TStateEvent';
import { RoomMembers } from '../types/roomMembers';
import { TUserAccount } from '@/model/users/TUser';

// TODO: Too many requests are needed to get information about the Hub.
// This needs to be optimized

export class ManagementUtils {
	/******* Utility function *********/

	// Utility function for room name and power level extraction
	// This utility function only helps to maintain the goal of getting user permissions.
	static async getRoomNameAndPowerLevel(roomId: string, userId: string) {
		const pubhubs = usePubHubs();

		const roomState = await APIService.adminGetRoomState(roomId);

		// Extract room name
		let roomName = roomState?.state.find((event) => event.type === EventType.RoomName)?.content.name;

		// Room Name for automatically  generated can be taken from canonical alias - Example is General room
		// by @system_bot:testhub.matrix.host. These rooms does not have name in room state.
		// Better to keep their name as alias. The form of the alias doesn't
		if (!roomName) roomName = roomState?.state.find((event) => event.type === EventType.RoomCanonicalAlias)?.content.alias;
		if (!roomName) throw new Error('Event for Name not found.');
		// Extract room type
		const joinRuleEvent = roomState.state.find((event) => event.type === EventType.RoomJoinRules);
		const isPublicRoom = joinRuleEvent?.content?.join_rule === 'public';

		// Extract power level event
		const powerLevelsEvent = roomState.state.find((event) => event.type === EventType.RoomPowerLevels);
		if (!powerLevelsEvent) throw new Error('Event for Power Level not found.');

		// If the user object exits in power level
		const usersPowerLevel = powerLevelsEvent.content.users || {};

		// If there is no user object or the given userId is not present in user object
		// then permission is of normal user - no user object means no permission.
		const userPowerLevel = usersPowerLevel[userId] || 0;

		// Check whether admin has rights to the room i.e., admin has created the room.
		const adminPowerLevel = (pubhubs.getUserId && usersPowerLevel[pubhubs.getUserId]) || 0;

		return { roomId, roomName, userPowerLevel, isPublicRoom, adminPowerLevel: adminPowerLevel };
	}

	// Check if admin is a room creator.
	static async roomCreatorIsMember(roomId: string): Promise<boolean> {
		const roomState = await APIService.adminGetRoomState(roomId);
		// Room State is empty when creator leaves the room without any users joining the room.
		if (Array.isArray(roomState.state) && roomState.state.length == 0) throw Error('Room state is empty');

		//Otherwise, we check if the creator has left the room, because
		const roomMembers: RoomMembers = await APIService.adminGetRoomMembers(roomId);
		const roomCreator: TRoomCreate | undefined = roomState.state.find((roomEvent) => roomEvent.type === EventType.RoomCreate);
		if (roomCreator === undefined) throw Error(`No creator of room  ${roomId}`);
		if (!roomMembers.members.find((member: string) => member === roomCreator.user_id)) {
			return false;
		} else {
			return true;
		}
	}

	// List Admin members of the room
	static async getAdminUsersId(roomId: string): Promise<string[]> {
		const roomState: TState = await APIService.adminGetRoomState(roomId);
		const powerLevel = roomState.state.find((event) => event.type === EventType.RoomPowerLevels);
		if (!powerLevel) return [];
		const users = powerLevel?.content.users;
		const onlyAdminUsers = Object.keys(users).filter((userId) => users[userId] === 100);
		return onlyAdminUsers;
	}

	// Fetch user account data which iterates until all data is fetched.
	static async getUsersAccounts(): Promise<TUserAccount[]> {
		const allUsers: TUserAccount[] = [];
		let from = '0';
		// Arbitary limit value.
		// The bigger the value, the less requests are sent to get useraccount.
		const limit = '500';
		let response;

		do {
			response = await APIService.adminListUsers(from, limit);
			allUsers.push(...(response.users || []));
			from = response.next_token; // Update 'from' to the next_token for the next iteration
		} while (from); // Continue until there is no next_token
		return allUsers;
	}
}
