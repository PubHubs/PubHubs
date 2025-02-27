import { IUserManagement } from '@/model/hubmanagement/interfaces/IUserManagement';
import { IRoomManagement } from '../interfaces/IRoomManagement';
import { ISuspendUser } from '../interfaces/ISuspendUser';
import { SharedAccessManagement } from './sharedmanagement';
import { RoomPowerLevelsEventContent } from 'matrix-js-sdk/lib/@types/state_events';
import { TUserAccountList } from '@/model/users/TUser';
import { usePubHubs } from '@/logic/core/pubhubsStore';
import { TUserJoinedRooms } from '@/model/users/TUser';
import { APIService } from '@/logic/core/apiHubManagement';
import { UserRoomPermission } from '../types/roomPerm';
import { ManagementUtils } from '../utility/managementutils';
import { ISendEventResponse } from 'matrix-js-sdk';

/* Administrator can create, delete, update room. Administrator can also change permissions.  */
/* Matrix synapse uses power levels but admin class use Permissions instead of power level */
/* TODO:
1. Does caching via Pinia makes sense for a request that already has been done
*/

export class Administrator implements IUserManagement, IRoomManagement, ISuspendUser {
	// Access list will be shared by administrator and moderator - therefore it is done via composition.
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
	 * @param powerLevel changes the permissions depending on the power level i.e., 0 -user, 50 - moderator, 100 - admin.
	 */

	async changePermission(userId: string, roomId: string, powerLevel: number): Promise<ISendEventResponse> {
		const pubhubs = usePubHubs();
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
