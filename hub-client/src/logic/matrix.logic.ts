// Packages
import { EventType } from 'matrix-js-sdk';
import type { MSC3575List, MSC3575RoomSubscription } from 'matrix-js-sdk/lib/sliding-sync.js';

import { SystemDefaults } from '@hub-client/models/constants';

// #region Subscriptions

// Room list subscription (the list/filter fed to SlidingSync)
const RoomSubscription: MSC3575List = {
	ranges: [[0, 999]],
	required_state: [
		[EventType.RoomCreate, ''],
		[EventType.RoomName, ''],
		[EventType.RoomMember, '*'],
		[EventType.RoomPowerLevels, ''],
		[EventType.RoomTopic, ''],
	],
	timeline_limit: 10,
};

// Per-room timeline subscription (used for custom timeline_xxx subscriptions)
const TimelineSubScription: MSC3575RoomSubscription = {
	required_state: [
		['m.room.name', ''],
		['m.room.member', ''],
		['m.room.avatar', ''],
	],
	timeline_limit: SystemDefaults.SyncTimelineLimit, // limit specific per room
};

// #endregion

// #region Helpers

/**
 * Helper function to make a name for the timeline subscription
 */
const makeTimelineSubscriptionName = (roomId: string) => `timeline_${roomId}`;

// #endregion

// Exports
export { makeTimelineSubscriptionName, RoomSubscription, TimelineSubScription };
