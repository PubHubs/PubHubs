// Packages
import { EventType, IStateEvent, type MatrixClient } from 'matrix-js-sdk';
import { MSC3575List, MSC3575RoomData, MSC3575SlidingSyncResponse, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk/lib/sliding-sync';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';
import { RoomSubscription, TimelineSubScription, makeTimelineSubscriptionName } from '@hub-client/logic/matrix.logic.js';

// Models
import { MatrixType, SystemDefaults } from '@hub-client/models/constants';
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
	private subscribedRooms = new Map<string, string>(); // TODO: Move to store

	// TODO: Use room composable instead
	private roomsStore = useRooms();

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
	 * @params client - The Matrix client to use
	 *
	 * @throws {Error} If the client is not provided
	 * @throws {Error} If the SlidingSyncService fails to start
	 */
	async startSync() {
		if (!this.client) throw new Error('Matrix client required');
		if (this.slidingSync) throw new Error('SlidingSync already started');

		LOGGER.log(SMI.SYNC, 'Starting Sliding Sync');

		const filterList = new Map<string, MSC3575List>([['all', RoomSubscription]]);

		this.slidingSync = new SlidingSync(this.client.baseUrl, filterList, { timeline_limit: 10 }, this.client, SystemDefaults.syncIntervalMS);

		// Attach event handlers
		this.slidingSync.on(SlidingSyncEvent.Lifecycle, this.handleLifecycleEvent);
		this.slidingSync.on(SlidingSyncEvent.RoomData, this.handleRoomDataEvent);

		try {
			await this.client.startClient({ threadSupport: true, includeArchivedRooms: false });
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
	 * @throws {Error} If remving listeners failed
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
	 * Add a subscription to a room to the Sliding Sync.
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

		const timeLineKey = makeTimelineSubscriptionName(roomId);

		try {
			this.slidingSync.addCustomSubscription(timeLineKey, TimelineSubScription);
			this.subscribedRooms.set(roomId, timeLineKey);
			LOGGER.log(SMI.SYNC, `Added room subscription for ${roomId} with timeline key ${timeLineKey}`, { roomId, timeLineKey });
			return timeLineKey;
		} catch (err) {
			LOGGER.error(SMI.SYNC, `Failed to subscribe to ${roomId}`, { roomId, err });
			throw err;
		}
	}

	/**
	 * Use a subscription to sync a room using the Sliding Sync.
	 *
	 * @params roomId - The id of the room to sync
	 *
	 * @throws {Error} If the synchronization fails
	 */
	syncRoom(roomId: string): void {
		if (!this.slidingSync) {
			LOGGER.error(SMI.SYNC, `Cannot sync room ${roomId} because there is no active sync`, { roomId });
			return;
		}

		const timeLineKey = this.subscribedRooms.get(roomId) ?? this.addRoomSubscription(roomId);
		if (!timeLineKey) return;

		try {
			this.slidingSync.useCustomSubscription(roomId, timeLineKey);
			this.slidingSync.modifyRoomSubscriptions(new Set(this.subscribedRooms.keys()));
			LOGGER.log(SMI.SYNC, `Synced room ${roomId}`, { roomId });
		} catch (err) {
			LOGGER.warn(SMI.SYNC, `Cannot sync room ${roomId}`, { roomId, err });
			throw err;
		}
	}

	// TODO: Might need refactoring to align with new file structure.
	// Also needs to be added to the store and composable
	syncUsersProfile(roomData: MSC3575RoomData): boolean {
		const currentUser = useUser();

		// profile data of members is in the join content of roommember events, need only update when there is new content
		const membersOnlyProfileUpdate = roomData.required_state.filter((x) => x.type === EventType.RoomMember && x.content?.membership === MatrixType.Join && JSON.stringify(x.content) !== JSON.stringify(x.prev_content));
		if (membersOnlyProfileUpdate.length === 0) return false;

		membersOnlyProfileUpdate.forEach((member) => {
			const profile = {
				avatar_url: member.content.avatar_url ?? undefined,
				displayname: member.content.displayname ?? undefined,
			};
			currentUser.setAllProfiles(member.sender, profile);
		});

		return true;
	}

	// #endregion

	// #region Event handlers

	/**
	 * Creates a promise from joining a room and putting it in the roomsStore
	 * @param roomId id of the room to join
	 * @param roomType type of the room to join
	 * @param roomName name of the room to join
	 * @param required_state required_state as coming from the sync
	 * @returns void
	 */
	private async getJoinRoomPromise(roomId: string, roomType: string, roomName: string, required_state: IStateEvent[]): Promise<any> {
		return this.client!.joinRoom(roomId)
			.then((joinedRoom) => {
				this.client!.store.storeRoom(joinedRoom);
				this.roomsStore.initRoomsWithMatrixRoom(joinedRoom, roomName, roomType, required_state);
				const timelineKey = this.addRoomSubscription(roomId);
				if (timelineKey) this.syncRoom(roomId);
			})
			.catch((err) => {
				LOGGER.error(SMI.SYNC, `Failed joining room ${roomId}`, { roomId, err });
			});
	}

	/**
	 * Handles lifeCycle events from the sync: roomData
	 * @param state sliding sync state
	 * @param response response coming from sync
	 * @returns void
	 */
	private handleLifecycleEvent = async (state: SlidingSyncState | null, response: MSC3575SlidingSyncResponse | null) => {
		try {
			const currentUser = useUser();
			if (state !== SlidingSyncState.Complete) return;

			const roomList = response?.rooms;
			if (!roomList) return;
			//console.error('sliding sync room ', roomList);

			const joinPromises: Promise<any>[] = [];

			for (const [roomId, roomData] of Object.entries(roomList)) {
				this.syncUsersProfile(roomData);

				// get the latest roommember info from the required state, sorted on timestamp. This should be join if the user is still joined
				const latestRoomMemberInfo = roomData.required_state.filter((x) => x.type === EventType.RoomMember && x.sender === currentUser.userId).sort((a, b) => b.origin_server_ts - a.origin_server_ts)[0];

				if (latestRoomMemberInfo?.content.membership === MatrixType.Join) {
					const roomType = roomData.required_state.find((x) => x.type === EventType.RoomCreate)?.content?.type ?? RoomType.PH_MESSAGES_DEFAULT;
					joinPromises.push(this.getJoinRoomPromise(roomId, roomType, roomData.name, roomData.required_state));
				}

				// get the invite state
				// for now we only use invites for direct messages so we can automatically join
				// in the future perhaps show roomdata and ask to be joined?
				const inviteState = roomData.invite_state;
				if (inviteState) {
					const roomType = inviteState.find((x) => x.type === EventType.RoomCreate)?.content?.type;
					const roomName = inviteState.find((x) => x.type === EventType.RoomName)?.content?.name;
					if (DirectRooms.includes(roomType) && roomName) {
						const invites = inviteState.filter((x) => x.type === EventType.RoomMember && x.state_key === currentUser.userId && x.content?.[MatrixType.MemberShip] === MatrixType.Invite);
						invites.forEach((x) => {
							joinPromises.push(this.getJoinRoomPromise(roomId, roomType, roomName, roomData.required_state));
						});
					}
				}
			}

			await Promise.all(joinPromises);
			this.roomsStore.setRoomsLoaded(true);
		} catch (err) {
			LOGGER.error(SMI.SYNC, 'Lifecycle handler failed', { err });
			throw err;
		}
	};

	/**
	 * Loads roomdata from sync into the room
	 * @param id roomId
	 * @param roomData roomData as from sync
	 */
	private handleRoomDataEvent = (id: string, roomData: MSC3575RoomData) => {
		try {
			//console.error('sliding sync roomdata ', roomData);
			this.roomsStore.loadFromSlidingSync(id, roomData);
		} catch (err) {
			LOGGER.error(SMI.SYNC, 'RoomData handler failed', { id, err });
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