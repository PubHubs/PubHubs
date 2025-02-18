/**
 * Helper class for handling backend service related to advance user like admin or moderator.
 */

import { TUserAccountList, TUserJoinedRooms } from '@/model/users/TUser';
import { TState } from '@/model/events/TStateEvent';
import { api_synapse, api_matrix } from '@/core/api';
import { RoomMembers } from '../types/roomMembers';
import { AccessToken } from '../types/authType';
import { UserAccount } from '../types/userAccount';

export class APIService {
	/** See https://github.com/element-hq/synapse/blob/develop/docs/admin_api/user_admin_api.md#list-accounts
	 *  List all user accounts.
	 *  It has a filtering from and to.
	 * @returns TUserAccountList list of all user accounts.
	 */
	static async adminListUsers(from: string, to: string): Promise<TUserAccountList> {
		return await api_synapse.apiGET<TUserAccountList>(api_synapse.apiURLS.usersAPIV3.slice(0, -1) + '?from=' + from + '&' + 'limit=' + to);
	}

	/**
	 * See: https://github.com/element-hq/synapse/blob/develop/docs/admin_api/user_admin_api.md#list-room-memberships-of-a-user
	 * List room Ids for all the rooms that the user belongs to.
	 * @param userId
	 * @returns TUserJoinedRoom consists of the list of all room id
	 */
	static async adminListJoinedRoomId(userId: string): Promise<TUserJoinedRooms> {
		return await api_synapse.apiGET<TUserJoinedRooms>(api_synapse.apiURLS.usersAPIV1 + userId + '/joined_rooms');
	}

	/**
	 * See https://github.com/element-hq/synapse/blob/develop/docs/admin_api/rooms.md#room-state-api
	 * @param roomId
	 * @returns Returns the entire state of the room:
	 */

	static async adminGetRoomState(roomId: string): Promise<TState> {
		return await api_synapse.apiGET<TState>(api_synapse.apiURLS.roomsAPIV1 + roomId + '/state');
	}

	/**
	 * See https://github.com/element-hq/synapse/blob/develop/docs/admin_api/rooms.md#room-state-api
	 * @param roomId
	 * @returns Returns the entire state of the room:
	 */

	static async adminGetRoomMembers(roomId: string): Promise<RoomMembers> {
		return await api_synapse.apiGET<RoomMembers>(api_synapse.apiURLS.roomsAPIV1 + roomId + '/members');
	}

	/**
	 *  https://element-hq.github.io/synapse/latest/admin_api/rooms.html#make-room-admin-api
	 * @param roomId Room Id for the room to make the user an admin of.
	 * @param userId User Id of the user to make an admin of the room.
	 * Makes the given user an admin of the room.
	 * TODO: Make object type - A service response type of status and message.
	 */
	static async makeRoomAdmin(roomId: string, userId: string): Promise<void> {
		await api_synapse.apiPOST(api_synapse.apiURLS.roomsAPIV1 + roomId + '/make_room_admin', { user_id: userId });
	}

	/**
	 *  https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#login-as-a-user
	 *
	 * @param userId User Id of the user to login
	 * Get acccess token
	 * TODO: Make object type - A service response type of status and message.
	 */
	static async adminUserLogin(userId: string): Promise<AccessToken> {
		return await api_synapse.apiPOST(api_synapse.apiURLS.usersAPIV1 + userId + '/login', {});
	}

	/**
	 *  https://element-hq.github.io/synapse/latest/admin_api/user_admin_api.html#query-user-account
	 *
	 * @param userId User Id of the user to login
	 * Get acccess token
	 * TODO: Make object type - A service response type of status and message.
	 */
	static async adminQueryAccount(userId: string): Promise<UserAccount> {
		return await api_synapse.apiGET(api_synapse.apiURLS.usersAPIV2 + userId);
	}

	// Join the room with an access token of another admin
	static async forceRoomJoin(roomId: string, accessToken: string) {
		api_matrix.setAccessToken(accessToken);
		api_matrix.apiPOST(api_matrix.apiURLS.join + roomId, {});
	}
}
