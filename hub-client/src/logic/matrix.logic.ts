// Packages
import { EventType } from 'matrix-js-sdk';
import { type MSC3575List, type MSC3575RoomSubscription, MSC3575_STATE_KEY_LAZY, MSC3575_STATE_KEY_ME, MSC3575_WILDCARD } from 'matrix-js-sdk/lib/sliding-sync.js';

import { MatrixEventType, SlidingSyncOptions, SystemDefaults } from '@hub-client/models/constants';

// #region Subscriptions

/*
Main mechanism for sliding sync

First collect all rooms by an initialroomlist that asks for all the rooms with Name and Memberdata
As soon as that is loaded remove this list and replace by a list that for now handles most basic syncing: ask for the recent rooms the full data

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
		[MatrixEventType.RoomType, MSC3575_WILDCARD],
		[EventType.RoomMember, MSC3575_WILDCARD],
		[EventType.RoomPowerLevels, MSC3575_WILDCARD],
	],
	timeline_limit: 0, // don't need events here
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
	timeline_limit: SystemDefaults.initialRoomTimelineLimit, // despite subscribing to rooms we also initially need the timeline here
};
// Put Roomlists in map for easy handling
const RoomLists = new Map<string, MSC3575List>([
	[SlidingSyncOptions.initialRoomList, InitialRoomList],
	[SlidingSyncOptions.mainRoomList, MainRoomList],
]);

// Per-room timeline subscription (used for custom timeline_xxx subscriptions)
const MainRoomSubscription: MSC3575RoomSubscription = {
	required_state: [
		['m.room.name', MSC3575_WILDCARD],
		['m.room.member', MSC3575_STATE_KEY_LAZY],
		['m.room.avatar', MSC3575_WILDCARD],
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
