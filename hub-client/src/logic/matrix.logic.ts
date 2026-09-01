// Packages
import { EventType } from 'matrix-js-sdk';
import {
	type MSC3575List,
	type MSC3575RoomSubscription,
	MSC3575_STATE_KEY_LAZY,
	MSC3575_STATE_KEY_ME,
	MSC3575_WILDCARD,
} from 'matrix-js-sdk/lib/sliding-sync.js';

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
	timeline_limit: 0, // initially no events, this is used for the roomlist in the sidebar.
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
	timeline_limit: 10, // enough events so at least one is usually a visible message for unread computation; increased from 1
};

/*
Unread-only variants, used by the miniclient.

The miniclient renders one dot per hub and no other chrome, so it needs a room's type (to know
whether the dot applies to it at all), this user's own membership, and the receipts the unread
computation compares against — and none of the member list, power levels or arbitrary state the
full client draws its UI from.

That distinction matters most at [RoomMember, MSC3575_WILDCARD] in the lists above: the state key
of a member event is a user id, so a wildcard there asks for *every member of every room* on every
sync. The full client earns that (moderation views read other members out of the room list, see
useUserRooms and useRoomDetails); a dot does not. MainRoomList's ['*', '*'] is the same story for
every other state type.
*/
const unreadOnlyRequiredState: MSC3575List['required_state'] = [
	[EventType.RoomName, MSC3575_WILDCARD],
	[EventType.RoomCreate, MSC3575_WILDCARD],
	[EventType.RoomMember, MSC3575_STATE_KEY_ME],
	[MatrixEventType.RoomReceipt, MSC3575_WILDCARD],
	[MatrixEventType.RoomReadMarker, MSC3575_WILDCARD],
];

const UnreadOnlyInitialRoomList: MSC3575List = {
	ranges: [[0, SystemDefaults.initialRoomListRange]],
	sort: [SlidingSyncOptions.byRecency, SlidingSyncOptions.byNotificationLevel],
	required_state: unreadOnlyRequiredState,
	timeline_limit: 0,
};

const UnreadOnlyMainRoomList: MSC3575List = {
	ranges: [[0, SystemDefaults.mainRoomListRange]],
	sort: [SlidingSyncOptions.byRecency],
	required_state: unreadOnlyRequiredState,
	timeline_limit: 10, // as MainRoomList: enough events that one is usually a visible message
};

// Put Roomlists in map for easy handling
const RoomLists = new Map<string, MSC3575List>([
	[SlidingSyncOptions.initialRoomList, InitialRoomList],
	[SlidingSyncOptions.mainRoomList, MainRoomList],
	[SlidingSyncOptions.unreadOnlyInitialRoomList, UnreadOnlyInitialRoomList],
	[SlidingSyncOptions.unreadOnlyMainRoomList, UnreadOnlyMainRoomList],
]);

/**
 * How much of a hub a sync needs to see. Full drives the hub client's UI; UnreadOnly backs the
 * miniclient's dot and asks the server for as little as that answer requires.
 */
enum SyncProfile {
	Full = 'full',
	UnreadOnly = 'unreadOnly',
}

/** The (initial, main) room list keys a sync profile runs through, in that order. */
const roomListsForProfile = (profile: SyncProfile): { initial: string; main: string } =>
	profile === SyncProfile.UnreadOnly
		? { initial: SlidingSyncOptions.unreadOnlyInitialRoomList, main: SlidingSyncOptions.unreadOnlyMainRoomList }
		: { initial: SlidingSyncOptions.initialRoomList, main: SlidingSyncOptions.mainRoomList };

// Per-room timeline subscription (used for custom timeline_xxx subscriptions)
const MainRoomSubscription: MSC3575RoomSubscription = {
	required_state: [
		[EventType.RoomName, MSC3575_WILDCARD],
		[EventType.RoomMember, MSC3575_STATE_KEY_LAZY],
		[EventType.RoomAvatar, MSC3575_WILDCARD],
	],
	timeline_limit: SystemDefaults.SubscriptionRoomTimelineLimit, // limit specific per room, needed if a room needs less than the default of the sliding sync. Unused for now
};

// #endregion

// #region Helpers

/**
 * Helper function to make a name for the timeline subscription
 */
const makeMainRoomSubscriptionName = (roomId: string) => `timeline_${roomId}`;

// #endregion

// Exports
export { makeMainRoomSubscriptionName, RoomLists, MainRoomSubscription, SyncProfile, roomListsForProfile };
