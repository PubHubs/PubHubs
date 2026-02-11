// Packages
import { EventType, IRoomEvent, IStateEvent, type MatrixClient } from 'matrix-js-sdk';
import { MSC3575List, MSC3575RoomData, MSC3575SlidingSyncResponse, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk/lib/sliding-sync';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';
import { MainRoomSubscription, RoomLists, makeMainRoomSubscriptionName } from '@hub-client/logic/matrix.logic.js';

// Models
import { MatrixType, SlidingSyncOptions, SystemDefaults } from '@hub-client/models/constants';
import { RoomType } from '@hub-client/models/rooms/TBaseRoom';
import { DirectRooms } from '@hub-client/models/rooms/TBaseRoom';

// Stores
import { useRooms } from '@hub-client/stores/rooms';
import { useUser } from '@hub-client/stores/user';

/**
 * Service for the Matrix client
 */
class MatrixService {
	private slidingSync: SlidingSync | null = null;
	private client: MatrixClient | null = null;
	private subscribedRooms: Map<string, string> = new Map<string, string>(); // TODO: Move to store

	// TODO: Use room composable instead
	private roomsStore = useRooms();

	private roomsCount: number = 0; // number of rooms returned by sliding sync
	private roomsUpperRange: number = SystemDefaults.mainRoomListRange; // current number of the upper range of the roomlist
	private initialRoomLoading: boolean = true; // Are we fetching the first roomlist with only memberdata? (vs the main roomlist with all data)

	/**
	 * Construct a MatrixService instance.
	 *
	 * @param client - MatrixClient to set on the service at construction time
	 */
	constructor(client: MatrixClient) {
		this.client = client;
	}

	// #region Sliding Sync

	/**
	 * Check if the Sliding Sync is running.
	 *
	 * @returns Whether the Sliding Sync is running
	 */
	hasActiveSync(): boolean {
		return this.slidingSync !== null;
	}

	/**
	 * Start the Sliding Sync.
	 *
	 * @throws {Error} If the client is not provided
	 * @throws {Error} If the SlidingSyncService fails to start
	 */
	async startSync() {
		if (!this.client) throw new Error('Matrix client required');
		if (this.slidingSync) throw new Error('SlidingSync already started');

		LOGGER.log(SMI.SYNC, 'Starting Sliding Sync');

		const initialRoomListFilter = new Map<string, MSC3575List>([[SlidingSyncOptions.roomList, RoomLists.get(SlidingSyncOptions.initialRoomList)!]]);

		// TODO sliding sync update: the current version of the Matrix JS SDK does not support new SlidingSync({ client, lists, extensions, });
		// As soon as this is updated we need to pass the notifications in extensions: { unread_notifications: { enabled: true, }, },
		// and then the options from this.client.startClient can be removed, see further
		this.slidingSync = new SlidingSync(this.client.baseUrl, initialRoomListFilter, { timeline_limit: 100 /* global default value */ }, this.client, SystemDefaults.syncIntervalMS);

		// Attach event handlers
		this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.handleLifecycleEvent);
		this.slidingSync.on(SlidingSyncEvent.RoomData, this.handleRoomDataEvent);

		try {
			// debug only
			// (window as any).SYNC_TRACE = 1;

			// TODO sliding sync update: as soon as the sliding sync API is updated to new SlidingSync({ client, lists, extensions, }); we can remove lazyLoadMembers and initialSyncLimit again
			// The parameters to startClient used to be threadSupport and includeArchivedRooms
			// But since we need to get the full list of rooms to the client before syncing them to get the correct number of notifications
			// also lazyLoadMembers and initialSyncLimit are passed
			await this.client.startClient({ lazyLoadMembers: true, initialSyncLimit: 0, threadSupport: true, includeArchivedRooms: false });

			await this.slidingSync.start();

			LOGGER.log(SMI.SYNC, 'Sliding Sync started');
		} catch (err) {
			LOGGER.error(SMI.SYNC, 'Failed to start the Sliding Sync', { err });
			this.stopSync();
			throw err;
		}
	}

	/**
	 * Stop the Sliding Sync service.
	 *
	 * @throws {Error} If removing listeners failed
	 * @throws {Error} If stopping the Sliding Sync service failed
	 */
	stopSync() {
		if (!this.slidingSync) return;

		LOGGER.log(SMI.SYNC, 'Stopping Sliding Sync');

		// Attempt to remove listeners of the Sliding Sync
		try {
			this.slidingSync.off(SlidingSyncEvent.Lifecycle, this.handleLifecycleEvent);
			this.slidingSync.off(SlidingSyncEvent.RoomData, this.handleRoomDataEvent);
		} catch (err) {
			LOGGER.warn(SMI.SYNC, 'Failed to remove listeners from the Sliding Sync', {
				err,
			});
			throw err;
		}

		// Attempt to stop the Sliding Sync service
		try {
			this.slidingSync.stop();
		} catch (err) {
			LOGGER.warn(SMI.SYNC, 'Failed to stop the Sliding Sync', {
				err,
			});
			throw err;
		}

		this.slidingSync = null;
		this.subscribedRooms.clear();

		try {
			if (this.client) {
				this.client.stopClient();
				LOGGER.log(SMI.SYNC, 'Matrix client stopped');
			}
		} catch (err) {
			LOGGER.warn(SMI.SYNC, 'Failed to stop Matrix client', { err });
		}

		LOGGER.log(SMI.SYNC, 'Sliding Sync stopped');
	}

	/**
	 * Switch the list of sliding sync after collecting the initial roomslist
	 * When there are more rooms than the current upperRange: increase it to wait for the next load of rooms
	 */
	private SetRoomSlidingSync() {
		const mainRoomList = RoomLists.get(SlidingSyncOptions.mainRoomList);
		mainRoomList!.ranges[0][1] = this.roomsUpperRange;

		// change sliding sync to current mainRoomlist
		this.slidingSync?.setList(SlidingSyncOptions.roomList, mainRoomList!);

		// increase the upperrange for the next time
		if (this.roomsUpperRange < this.roomsCount) {
			this.roomsUpperRange += SystemDefaults.mainRoomListRange;
		}
	}

	/**
	 * Add a subscription to a room to the Sliding Sync and starts syncing
	 *
	 * @params roomId - The id of the room to subscribe to
	 *
	 * @throws {Error} If subscribing to the room failed
	 */
	addRoomSubscription(roomId: string): string | undefined {
		if (!this.slidingSync) {
			LOGGER.error(SMI.SYNC, `Cannot add room subscription for ${roomId}. There is no active sync`, { roomId });
			return undefined;
		}

		const timeLineKey = makeMainRoomSubscriptionName(roomId);

		try {
			// When subscribing to multiple rooms
			// this.slidingSync.addCustomSubscription(timeLineKey, MainRoomSubscription);
			// this.subscribedRooms.set(roomId, timeLineKey);
			// this.slidingSync.useCustomSubscription(roomId, timeLineKey);
			// this.slidingSync.modifyRoomSubscriptions(new Set(this.subscribedRooms.keys()));

			// Subscribe only to one room
			this.slidingSync.addCustomSubscription(timeLineKey, MainRoomSubscription);
			this.slidingSync.useCustomSubscription(roomId, timeLineKey);
			this.slidingSync.modifyRoomSubscriptions(new Set([roomId]));

			LOGGER.log(SMI.SYNC, `Added room subscription for ${roomId} with timeline key ${timeLineKey}`, { roomId, timeLineKey });

			return timeLineKey;
		} catch (err) {
			LOGGER.error(SMI.SYNC, `Failed to subscribe to ${roomId}`, { roomId, err });
			throw err;
		}
	}

	// #endregion

	// #region Event handlers

	/**
	 * Creates a promise from joining a room and putting it in the roomsStore
	 *
	 * @param roomId - Id of the room to join
	 * @param roomType - Type of the room to join
	 * @param roomName - Tame of the room to join
	 */
	private async getJoinRoomPromise(roomId: string, roomType: string, roomName: string, required_state: IStateEvent[], timeline: (IStateEvent | IRoomEvent)[]): Promise<void> {
		this.client!.getRoom(roomId); // Puts the room in the client store

		const lastMessageId = timeline.findLast((x) => x.type === EventType.RoomMessage)?.event_id;
		return this.roomsStore.updateRoomList({
			roomId: roomId,
			roomType: roomType,
			name: roomName,
			stateEvents: required_state,
			lastMessageId: lastMessageId,
			isHidden: false,
		}); // Update the roomlist with the current room
	}

	/**
	 * Handles lifeCycle events from the sync: roomData
	 * For now there is no pagination in the rooms.
	 * If we want to implement that, see for instance: https://github.com/element-hq/element-web/blob/bb582fa8f3c859a2b7430ee70c5ea9a69c4910c8/src/SlidingSyncManager.ts#L339 the startspidering method
	 *
	 * @param state - Sliding sync state
	 * @param response - Response coming from sync
	 */
	private handleLifecycleEvent = async (state: SlidingSyncState | null, response: MSC3575SlidingSyncResponse | null): Promise<void> => {
		try {
			const currentUser = useUser();
			if (state !== SlidingSyncState.Complete) return;

			this.roomsCount = response?.lists.roomList.count ?? 0;
			const roomList = response?.rooms;
			if (this.roomsCount <= 0 || !roomList || Object.keys(roomList).length <= 0) {
				this.roomsStore.setRoomsLoaded(true);
				return;
			}
			//console.error("handleLifecycleEvent roomList", roomList);

			const joinPromises: Promise<any>[] = [];

			for (const [roomId, roomData] of Object.entries(roomList)) {
				currentUser.loadFromSlidingSync(roomData);

				// Get the latest roommember info from the required state, sorted on timestamp. This should be join if the user is still joined
				const latestRoomMemberInfo = roomData.required_state?.filter((x) => x.type === EventType.RoomMember && x.state_key === currentUser.userId).sort((a, b) => b.origin_server_ts - a.origin_server_ts)[0];

				// The roomlist is initially send twice: on sync start and later during the sync
				// Only handle the join when the room is not joined yet
				if (!this.roomsStore.rooms[roomId] && latestRoomMemberInfo?.content.membership === MatrixType.Join) {
					const roomType = roomData.required_state.find((x) => x.type === EventType.RoomCreate)?.content?.type ?? RoomType.PH_MESSAGES_DEFAULT;
					// For direct rooms, use actual m.room.name state event (contains user IDs for hidden state filtering)
					// For other rooms, use computed roomData.name from sliding sync
					const stateRoomName = roomData.required_state.find((x) => x.type === EventType.RoomName)?.content?.name;
					const roomName = DirectRooms.includes(roomType) && stateRoomName ? stateRoomName : roomData.name;
					joinPromises.push(this.getJoinRoomPromise(roomId, roomType, roomName, roomData.required_state, roomData.timeline));
				}

				// Get the invite state
				// For now we only use invites for direct messages so we can automatically join
				// In the future perhaps show roomdata and ask to be joined?
				const inviteState = roomData.invite_state;
				if (inviteState) {
					const roomType = inviteState.find((x) => x.type === EventType.RoomCreate)?.content?.type;
					const roomName = inviteState.find((x) => x.type === EventType.RoomName)?.content?.name;
					if (DirectRooms.includes(roomType) && roomName) {
						const invites = inviteState.filter((x) => x.type === EventType.RoomMember && x.state_key === currentUser.userId && x.content?.[MatrixType.MemberShip] === MatrixType.Invite);
						invites.forEach(() => {
							joinPromises.push(this.getJoinRoomPromise(roomId, roomType, roomName, roomData.required_state, roomData.timeline));
						});
					}
				}
			}

			Promise.all(joinPromises).then(() => {
				if (this.initialRoomLoading) {
					this.initialRoomLoading = false;
				}
				this.SetRoomSlidingSync(); // Sets the correct sliding sync for the room
				this.roomsStore.setRoomsLoaded(true);
			});
		} catch (err) {
			LOGGER.error(SMI.SYNC, 'Lifecycle handler failed', { err });
			throw err;
		}
	};

	/**
	 * Loads roomdata from sync into the room
	 *
	 * @param roomId - Room id
	 * @param roomData - RoomData as from the sync
	 */
	private handleRoomDataEvent = (roomId: string, roomData: MSC3575RoomData) => {
		try {
			//console.error("handleRoomDataEvent roomData ", roomData);
			this.roomsStore.loadFromSlidingSync(roomId, roomData);
		} catch (err) {
			LOGGER.error(SMI.SYNC, 'RoomData handler failed', { roomId, err });
		}
	};

	// #endregion
}

// #region Singletons

let matrixService: MatrixService | null = null;

/**
 * Initializes the MatrixService singleton with a Matrix client.
 * If already initialized, returns the existing instance.
 *
 * @param client - The Matrix client instance
 * @returns The initialized MatrixService singleton
 */
const initMatrixService = (client: MatrixClient) => {
	if (!matrixService) matrixService = new MatrixService(client);
	return matrixService;
};

/**
 * Retrieves the MatrixService singleton instance.
 * Must be called after `initMatrixService`.
 *
 * @returns The MatrixService singleton
 */
const useMatrixService = (): MatrixService => {
	if (!matrixService) throw new Error('MatrixService not initialized.');
	return matrixService;
};

// #endregion

// Exports
export { MatrixService, initMatrixService, useMatrixService };
