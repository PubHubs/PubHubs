// Packages
import { ISendEventResponse } from 'matrix-js-sdk';
import { RoomPowerLevelsEventContent } from 'matrix-js-sdk/lib/@types/state_events';

// Logic
import { APIService } from '@hub-client/logic/core/apiHubManagement';

// Models
import { IRoomManagement } from '@hub-client/models/hubmanagement/interfaces/IRoomManagement';
import { ISuspendUser } from '@hub-client/models/hubmanagement/interfaces/ISuspendUser';
import { IUserManagement } from '@hub-client/models/hubmanagement/interfaces/IUserManagement';
import { SharedAccessManagement } from '@hub-client/models/hubmanagement/models/sharedmanagement';
import { UserRoomPermission } from '@hub-client/models/hubmanagement/types/roomPerm';
import { ManagementUtils } from '@hub-client/models/hubmanagement/utility/managementutils';
import { TUserAccountList } from '@hub-client/models/users/TUser';
import { TUserJoinedRooms } from '@hub-client/models/users/TUser';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

/* Administrator can create, delete, update room. Administrator can also change permissions.  */
/* Matrix synapse uses power levels but admin class use Permissions instead of power level */
/* TODO:
1. Does caching via Pinia makes sense for a request that already has been done
*/

export class Administrator implements IUserManagement, IRoomManagement, ISuspendUser {
	// Access list will be shared by administrator and steward - therefore it is done via composition.
	private accessListManager: SharedAccessManagement;

	constructor() {
		this.accessListManager = new SharedAccessManagement();
	}

	createRoom() {
		/*     */
	}

	deleteRoom() {
		/*       */
	}

	updateRoom() {
		/*       */
	}

	/**
	 *  List all user accounts.
	 *  TODO: ADD paginate on user account.
	 * @returns TUserAccountList list of all user accounts.
	 */
	async listUsers(from: string, to: string): Promise<TUserAccountList> {
		return await APIService.adminListUsers(from, to);
	}

	/** Admin can fetch the number of joined rooms for the user
	 *
	 * @returns An object containing list of user's room information like Permissions, room Id and name
	 * Permissions in synapse is represented via power level.
	 */
	async showUserPermissions(userId: string): Promise<UserRoomPermission[]> {
		// Get list of room Ids
		const joinedRoomIds: TUserJoinedRooms = await APIService.adminListJoinedRoomId(userId);

		// Use utility function to concurrently fetch and extract data for powerlevel
		return await Promise.all(
			joinedRoomIds.joined_rooms.map(async (roomId) => {
				const { roomName, userPowerLevel, isPublicRoom, adminPowerLevel } = await ManagementUtils.getRoomNameAndPowerLevel(roomId, userId);
				return { room_id: roomId, room_name: roomName, room_pl: userPowerLevel, public: isPublicRoom, admin_permission: adminPowerLevel };
			}),
		);
	}

	/**
	 *
	 * @param userId
	 * @param roomId
	 * @param powerLevel changes the permissions depending on the power level i.e., 0 -user, 50 - steward, 100 - admin.
	 */

	async changePermission(userId: string, roomId: string, powerLevel: number): Promise<ISendEventResponse> {
		const pubhubs = usePubhubsStore();
		const currentPls: RoomPowerLevelsEventContent = await pubhubs.getPoweLevelEventContent(roomId);
		const users = currentPls['users'] || {};
		users[userId] = powerLevel;
		currentPls['users'] = users;
		return await pubhubs.setPowerLevelEventContent(roomId, currentPls);
	}

	banUser(userId: string): void {
		/*  */ userId;
	}

	kickUser(userId: string): void {
		/**/ userId;
	}
}
