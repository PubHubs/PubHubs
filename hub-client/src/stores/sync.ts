// // Packages
// import { EventType, MatrixClient } from 'matrix-js-sdk';
// import { MSC3575List, MSC3575RoomData, MSC3575RoomSubscription, MSC3575SlidingSyncResponse, SlidingSync, SlidingSyncEvent, SlidingSyncState } from 'matrix-js-sdk/lib/sliding-sync.js';
// import { defineStore } from 'pinia';

// // Logic
// import { LOGGER } from '@hub-client/logic/logging/Logger.js';
// import { SMI } from '@hub-client/logic/logging/StatusMessage.js';

// // Models
// import { MatrixEventType, SystemDefaults } from '@hub-client/models/constants.js';
// import { DirectRooms, RoomType, SecuredRooms } from '@hub-client/models/rooms/TBaseRoom.js';
// import { TimelineManager } from '@hub-client/models/timeline/TimelineManager.js';

// // Stores
// import { useRooms } from '@hub-client/stores/rooms.js';
// import { useUser } from '@hub-client/stores/user.js';

// // Types
// enum RoomFilterKey {
// 	All = 'all',
// 	Public = 'public',
// 	Secured = 'secured',
// 	DM = 'dm',
// }

// // TODO Sliding sync: Push rules for notification. Now not all messages by default are in the unread counter. Instead only the messages that match push rules

// const RoomFilters: Record<RoomFilterKey, MSC3575List> = {
// 	[RoomFilterKey.All]: {
// 		ranges: [[0, 999]],
// 		required_state: [
// 			[EventType.RoomCreate, ''],
// 			[EventType.RoomName, ''],
// 			[EventType.RoomMember, '*'], // * => send all state events of this type
// 			[EventType.RoomPowerLevels, ''],
// 			[EventType.RoomTopic, ''],
// 		],
// 		timeline_limit: 10,
// 	},
// 	[RoomFilterKey.Public]: {
// 		ranges: [[0, 999]],
// 		filters: {
// 			// we need all public rooms, earlier rooms had no type in the create event, so we only can get all public rooms by ruling the non-public out
// 			not_room_types: [...SecuredRooms, ...DirectRooms],
// 		},
// 		required_state: [
// 			[EventType.RoomCreate, ''],
// 			[EventType.RoomName, ''],
// 			[EventType.RoomMember, '*'],
// 			[EventType.RoomTopic, ''],
// 		],
// 		timeline_limit: 10,
// 	},
// 	[RoomFilterKey.Secured]: {
// 		ranges: [[0, 999]],
// 		filters: {
// 			room_types: [...SecuredRooms],
// 		},
// 		required_state: [
// 			[EventType.RoomCreate, ''],
// 			[EventType.RoomName, ''],
// 			[EventType.RoomMember, '*'],
// 			[EventType.RoomTopic, ''],
// 		],
// 		timeline_limit: 10,
// 	},
// 	[RoomFilterKey.DM]: {
// 		ranges: [[0, 999]],
// 		filters: {
// 			room_types: [...DirectRooms],
// 		},
// 		required_state: [
// 			[EventType.RoomCreate, ''],
// 			[EventType.RoomName, ''],
// 			[EventType.RoomMember, '*'],
// 			[EventType.RoomTopic, ''],
// 		],
// 		timeline_limit: 10,
// 	},
// };

// const RoomMessagesSubscription: MSC3575RoomSubscription = {
// 	required_state: [
// 		[MatrixEventType.RoomName, ''],
// 		[MatrixEventType.RoomMember, ''],
// 		[MatrixEventType.RoomAvatar, ''],
// 	],
// 	timeline_limit: SystemDefaults.SyncTimelineLimit,
// };

// const useSyncStore = defineStore('sync', {
// 	state: () => ({
// 		slidingSync: null as SlidingSync | null,
// 		logger: LOGGER,
// 	}),

// 	actions: {
// 		/**
// 		 * Creates a subscription to the room with given id
// 		 * @param roomId
// 		 * @returns
// 		 */
// 		addRoomsubscription(roomId: string): string | undefined {
// 			//console.error('Adding room subscription for ', roomId);
// 			if (!this.$state.slidingSync) {
// 				LOGGER.error(SMI.SYNC, 'Cannot add room subscription for ${roomId} There is no active sync', { roomId });
// 				return undefined;
// 			}
// 			const timeLineKey = `timeline_${roomId}`;
// 			this.$state.slidingSync.addCustomSubscription(timeLineKey, RoomMessagesSubscription);
// 			LOGGER.log(SMI.SYNC, 'Added room subscription for ${roomId} with timeline key ${timeLineKey}', { roomId, timeLineKey });
// 			return timeLineKey;
// 		},

// 		/**
// 		 *
// 		 * @param roomId Starts syncing the subscription for the given roomId
// 		 * @param timeLineKey
// 		 * @param timelineManager
// 		 * @returns
// 		 */
// 		syncRoom(roomId: string, timeLineKey: string) {
// 			// TODO For higher initial speed I could shorten the poll interval, but that requires a stop and start
// 			// of the sync and with the original settings. Another way is to fetch the initial events in the roomlist, build the
// 			// window from there and in the meantime start the sync with the current interval
// 			if (!this.$state.slidingSync) {
// 				LOGGER.error(SMI.SYNC, 'Cannot sync room ${roomId} because there is no active sync', { roomId });
// 				return;
// 			}
// 			this.$state.slidingSync.useCustomSubscription(roomId, timeLineKey);
// 			this.$state.slidingSync.modifyRoomSubscriptions(new Set([roomId]));
// 		},

// 		/**
// 		 * This will start the sliding sync, for the given room filter key.
// 		 * This will fetch the rooms and start syncing them.
// 		 * @param roomFilterKey
// 		 * @param client
// 		 */
// 		async syncStart(roomFilterKey: RoomFilterKey, client: MatrixClient) {
// 			// TODO SlidingSync now we only fetch the rooms during startup, but leave/invite/join should be handled. See events.ts
// 			// TODO Check for connection state, like in the old way, see events.ts

// 			LOGGER.log(SMI.SYNC, 'Starting sliding sync');
// 			const rooms = useRooms();

// 			// convert filter to Map<string, MSC3575List>
// 			const filterList = new Map<string, MSC3575List>([[roomFilterKey, RoomFilters[roomFilterKey]]]);

// 			this.$state.slidingSync = new SlidingSync(client.baseUrl, filterList, { timeline_limit: 10 }, client, SystemDefaults.syncIntervalMS);

// 			// startup: roomlist
// 			this.$state.slidingSync.on(SlidingSyncEvent.Lifecycle, (state: SlidingSyncState | null, response: MSC3575SlidingSyncResponse | null) => {
// 				const room = this.$state.slidingSync?.getRoomSubscriptions();
// 				console.error('Lifecycle events Roomsubscriptions: ', room, state);

// 				// Only update profile once
// 				let profileUpdate = false;

// 				if (response?.rooms && Object.keys(response.rooms).length > 0) {
// 					//console.error('SlidingSyncEvent.Lifecycle ', state, response);
// 				}

// 				if (state === SlidingSyncState.Complete) {
// 					const roomList = response?.rooms;

// 					if (roomList) {
// 						const currentUser = useUser();

// 						for (const [roomId, roomData] of Object.entries(roomList)) {
// 							// Whenever any user changes their profile e.g., displayname or avatar.
// 							// It should be done once.

// 							this.syncUsersProfile(roomData);

// 							// roomList consists of all the rooms the user is in or has been in,
// 							// depending on join or leave: add Room to Roomlist or do nothing
// 							const roomMember = roomData.required_state.find((x) => x.type === EventType.RoomMember && x.sender === currentUser.userId);
// 							if (roomMember) {
// 								if (roomMember.content.membership === 'join') {
// 									const roomType = roomData.required_state.find((x) => x.type === EventType.RoomCreate)?.content?.type ?? RoomType.PH_MESSAGES_DEFAULT;
// 									client.joinRoom(roomId).then((joinedRoom) => {
// 										client.store.storeRoom(joinedRoom);
// 										rooms.initRoomsWithMatrixRoom(joinedRoom, roomData.name, roomType, roomData.required_state);
// 									});
// 								}
// 								// Future: handle other memberships here, like bans
// 							}
// 						}
// 					}
// 				}
// 			});

// 			// room: fetch events
// 			this.$state.slidingSync.on(SlidingSyncEvent.RoomData, (id: string, roomData: MSC3575RoomData) => {
// 				//console.error('RoomData for ', id, roomData);
// 				rooms.loadFromSlidingSync(id, roomData);
// 			});

// 			client
// 				.startClient({
// 					threadSupport: true,
// 					//initialSyncLimit: settings.pagination,
// 					includeArchivedRooms: false,
// 				})
// 				.then((result) => {
// 					console.error('Client started with result:', result);
// 				});

// 			await this.$state.slidingSync.start();
// 		},

// 		// Sync user profile when the user updates their profile data like Avatar and display name.
// 		syncUsersProfile(roomData: MSC3575RoomData): boolean {
// 			const currentUser = useUser();
// 			// filter on room members whose profile has changed.
// 			const membersOnlyProfileUpdate = roomData.required_state.filter((x) => x.type === EventType.RoomMember && JSON.stringify(x.content) !== JSON.stringify(x.prev_content));
// 			// Update only if users have changed their profile otherwise return.
// 			if (membersOnlyProfileUpdate.length === 0) return false;

// 			// Update profile information of all users whose profile information has been updated.
// 			// Update profile information of changed members
// 			membersOnlyProfileUpdate.forEach((member) => {
// 				const profile = {
// 					avatar_url: member.content.avatar_url ?? undefined,
// 					displayname: member.content.displayname ?? undefined,
// 				};
// 				currentUser.setAllProfiles(member.sender, profile);
// 			});
// 			return true;
// 		},
// 	},
// });

// export type SyncStore = ReturnType<typeof useSyncStore>;

// export { useSyncStore, RoomFilterKey };
