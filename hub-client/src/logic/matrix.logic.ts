// Packages
import { EventType } from 'matrix-js-sdk';
import { type MSC3575List, type MSC3575RoomSubscription, MSC3575_STATE_KEY_LAZY, MSC3575_STATE_KEY_ME, MSC3575_WILDCARD } from 'matrix-js-sdk/lib/sliding-sync.js';

import { MatrixEventType, SlidingSyncOptions, SystemDefaults } from '@hub-client/models/constants';

// #region Subscriptions

/*
Main mechanism for sliding sync

First collect all rooms by an initialroomlist that asks for all the rooms with Name, Memberdata and a timeline segment
These rooms are loaded into the RoomList of the rooms store and displayed in the menu. 
For each room the last message is saved. When a room is clicked in the menu, the last message is taken as the base for the timelineManager of the room 
and the room is subscribed to for further syncing.

As soon as the roomlist is loaded the initial list is removed and replaced by a list that for now handles most basic syncing: ask for the recent rooms the full data

After that: only the current room is subscribed to. And unsubscribed when the user turns to another room

In order to receive events in the subscription there always needs to be a list with a timeline_limit active, because a current bug in matrix 
lets the timeline_limit of the subscription be overwritten by the one in the list.
 */

// Initial RoomList: fetch all rooms by recency/notification and only the subset of data for the roomlist
const InitialRoomList: MSC3575List = {
	ranges: [[0, SystemDefaults.initialRoomListRange]],
	sort: [SlidingSyncOptions.byRecency, SlidingSyncOptions.byNotificationLevel],
	required_state: [
		[EventType.RoomName, MSC3575_WILDCARD],
		[EventType.RoomCreate, MSC3575_WILDCARD],
		[EventType.RoomMember, MSC3575_WILDCARD],
		[EventType.RoomPowerLevels, MSC3575_WILDCARD],
		[MatrixEventType.RoomReceipt, MSC3575_WILDCARD],
		[MatrixEventType.RoomReadMarker, MSC3575_WILDCARD],
	],
	timeline_limit: SystemDefaults.initialRoomTimelineLimit, // From this eventlist the roomtimeline is initially created
};

// Main Roomlist: fetch the most recent rooms with all required_state data and memberdata
const MainRoomList: MSC3575List = {
	ranges: [[0, SystemDefaults.mainRoomListRange]],
	sort: [SlidingSyncOptions.byRecency],
	required_state: [
		[EventType.RoomMember, MSC3575_STATE_KEY_ME],
		[EventType.RoomMember, MSC3575_STATE_KEY_LAZY],
		['*', '*'],
	],
	timeline_limit: SystemDefaults.initialRoomTimelineLimit, // We need the timeline events, this is for subsequent syncing
};

// Put Roomlists in map for easy handling
const RoomLists = new Map<string, MSC3575List>([
	[SlidingSyncOptions.initialRoomList, InitialRoomList],
	[SlidingSyncOptions.mainRoomList, MainRoomList],
]);

// Per-room timeline subscription (used for custom timeline_xxx subscriptions)
const MainRoomSubscription: MSC3575RoomSubscription = {
	required_state: [
		[EventType.RoomName, MSC3575_WILDCARD],
		[EventType.RoomMember, MSC3575_STATE_KEY_LAZY],
		[EventType.RoomAvatar, MSC3575_WILDCARD],
	],
	timeline_limit: SystemDefaults.SyncTimelineLimit, // limit specific per room
};

// #endregion

// #region Helpers

/**
 * Helper function to make a name for the timeline subscription
 */
const makeMainRoomSubscriptionName = (roomId: string) => `timeline_${roomId}`;

// #endregion

// Exports
export { makeMainRoomSubscriptionName, RoomLists, MainRoomSubscription };
