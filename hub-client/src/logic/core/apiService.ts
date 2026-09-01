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
	 * Send a room event over the client-server API, without the local echo the matrix-js-sdk
	 * creates for `client.sendMessage` / `client.sendEvent`.
	 * See https://spec.matrix.org/latest/client-server-api/#put_matrixclientv3roomsroomidsendeventtypetxnid
	 *
	 * Only for events PubHubs never renders as a message of their own: the ones carrying an
	 * `m.relates_to` that it reads back off the timeline itself (hidden messages, expert
	 * verifications, voting widget votes and edits). Sending those with a local echo makes the SDK
	 * throw "updatePendingEventStatus called on an event which is not a local echo", because:
	 *
	 * 1. `/sync` can deliver the event back before the send request resolves. The SDK matches it on
	 *    its transaction id and calls `Room.handleRemoteEcho`.
	 * 2. `handleRemoteEcho` always clears the echo's status, but only re-registers the event under
	 *    its real id when `Room.eventShouldLiveIn` says it belongs in the room timeline.
	 * 3. For an `m.relates_to` event that check follows the *target* message, looked up with
	 *    `Room.findEventById`, which searches only the *unfiltered* timeline. PubHubs paginates the
	 *    room through a filtered one (see `TimelineManager.getEventTimeline`), so a target outside
	 *    that window is not found: the event is then treated as belonging nowhere and its id is
	 *    never updated.
	 * 4. The send response reaches `Room.updatePendingEvent`, which now finds neither a timeline for
	 *    the new event id nor a status left to transition, and throws.
	 *
	 * Sending over the API directly skips both echo paths. The relation still goes out on the wire,
	 * so `TimelineManager` picks it up from `/sync` as usual.
	 *
	 * @param roomId Room to send the event into
	 * @param eventType Matrix event type, e.g. `m.room.message` or a `pubhubs.*` type
	 * @param content Event content
	 * @param txnId Transaction id, making the send idempotent. Take this from the SDK client's
	 *   `makeTxnId()` so it cannot collide with the ids the SDK uses for its own sends.
	 */
	static async sendRoomEvent(roomId: string, eventType: string, content: object, txnId: string): Promise<{ event_id: string }> {
		const path = `${api_matrix.apiURLS.rooms}${encodeURIComponent(roomId)}/send/${encodeURIComponent(eventType)}/${encodeURIComponent(txnId)}`;
		return await api_matrix.apiPUT<{ event_id: string }>(path, content);
	}

	/**
	 * Send an `m.room.message` without a local echo. See `sendRoomEvent`.
	 *
	 * @param roomId Room to send the message into
	 * @param content Event content, including its `msgtype`
	 * @param txnId Transaction id, see `sendRoomEvent`
	 */
	static async sendRoomMessage(roomId: string, content: object, txnId: string): Promise<{ event_id: string }> {
		return await APIService.sendRoomEvent(roomId, 'm.room.message', content, txnId);
	}
}
