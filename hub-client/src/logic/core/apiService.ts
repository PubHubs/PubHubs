// Logic
import { api_matrix, api_synapse } from '@hub-client/logic/core/api';

// Models
import { type TEventReportDetail, type TEventReportsResponse } from '@hub-client/models/events/TEventReport';
import { type TState } from '@hub-client/models/events/TStateEvent';
import { type AccessToken } from '@hub-client/models/hubmanagement/types/authType';
import { type RoomMembers } from '@hub-client/models/hubmanagement/types/roomMembers';
import { type UserAccount } from '@hub-client/models/hubmanagement/types/userAccount';
import { type TUserAccountList, type TUserJoinedRooms } from '@hub-client/models/users/TUser';

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
		return await api_synapse.apiGET<TState>(`${api_synapse.apiURLS.roomsAPIV1}${roomId}/state`);
	}

	/**
	 * Fetch event reports. Admins get all reports, stewards get reports for their rooms.
	 * @param isAdmin Whether the user is an admin
	 * @param from Pagination token
	 * @param limit Max results to return
	 */
	static async fetchReports(isAdmin: boolean, from?: number, limit = 100): Promise<TEventReportsResponse> {
		const endpoint = isAdmin ? api_synapse.apiURLS.eventReports : api_synapse.apiURLS.stewardReports;
		const fromParam = from !== undefined ? `&from=${from}` : '';
		return await api_synapse.apiGET<TEventReportsResponse>(`${endpoint}?limit=${limit}${fromParam}`);
	}

	/**
	 * Fetch a single event report with full details including event_json.
	 * @param reportId The report ID to fetch
	 */
	static async fetchReportDetail(reportId: number): Promise<TEventReportDetail> {
		return await api_synapse.apiGET<TEventReportDetail>(`${api_synapse.apiURLS.eventReports}/${reportId}`);
	}

	/**
	 * Delete an event report. Only admins can delete reports.
	 * @param reportId The report ID to delete
	 */
	static async deleteReport(reportId: number): Promise<void> {
		await api_synapse.apiDELETE(`${api_synapse.apiURLS.eventReports}/${reportId}`);
	}

	/**
	 * See https://github.com/element-hq/synapse/blob/develop/docs/admin_api/rooms.md#room-state-api
	 * @param roomId
	 * @returns Returns the entire state of the room:
	 */
	static async adminGetRoomMembers(roomId: string): Promise<RoomMembers> {
		return await api_synapse.apiGET<RoomMembers>(`${api_synapse.apiURLS.roomsAPIV1}${roomId}/members`);
	}

	/**
	 *  https://element-hq.github.io/synapse/latest/admin_api/rooms.html#make-room-admin-api
	 * @param roomId Room Id for the room to make the user an admin of.
	 * @param userId User Id of the user to make an admin of the room.
	 * Makes the given user an admin of the room.
	 * TODO: Make object type - A service response type of status and message.
	 */
	static async makeRoomAdmin(roomId: string, userId: string): Promise<void> {
		await api_synapse.apiPOST(`${api_synapse.apiURLS.roomsAPIV1}${roomId}/make_room_admin`, { user_id: userId });
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
		// Put our own token back afterwards: `api_matrix` is shared, so leaving the impersonated
		// admin's token on it would send every later call - room messages included - as that admin.
		const ownAccessToken = api_matrix.accessToken;
		try {
			api_matrix.setAccessToken(accessToken);
			await api_matrix.apiPOST(api_matrix.apiURLS.join + roomId, {});
		} finally {
			api_matrix.setAccessToken(ownAccessToken);
		}
	}

	/**
	 * See https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid
	 *
	 * Send an `m.room.message` over the client-server API, without the local echo the matrix-js-sdk
	 * creates for `client.sendMessage`.
	 *
	 * Only for messages PubHubs never renders as a message of their own: the ones carrying an
	 * `m.relates_to` that it reads back off the timeline itself (hidden messages, expert
	 * verifications). For those a local echo buys nothing and actively breaks.
	 * `Room.handleRemoteEcho` always clears the echo's status, but only re-registers it in the room
	 * timeline when `Room.eventShouldLiveIn` says the event belongs there - and for an `m.relates_to`
	 * event that check follows the *target* message. So relating to a thread reply, or to any message
	 * no longer in the loaded timeline, leaves the echo in no timeline at all, and the SDK then throws
	 * "updatePendingEventStatus called on an event which is not a local echo" while booking the send.
	 * Its scheduler retries that four more times, because a thrown Error carries no http status for
	 * the retry algorithm to give up on.
	 *
	 * @param roomId Room to send the message into
	 * @param content Event content, including its `msgtype`
	 * @param txnId Transaction id, making the send idempotent. Take this from the SDK client's
	 *   `makeTxnId()` so it cannot collide with the ids the SDK uses for its own sends.
	 */
	static async sendRoomMessage(roomId: string, content: object, txnId: string): Promise<{ event_id: string }> {
		const path = `${api_matrix.apiURLS.rooms}${encodeURIComponent(roomId)}/send/m.room.message/${encodeURIComponent(txnId)}`;
		return await api_matrix.apiPUT<{ event_id: string }>(path, content);
	}
}
