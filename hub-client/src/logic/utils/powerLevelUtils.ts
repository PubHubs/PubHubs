// Packages
import { EventType } from 'matrix-js-sdk';

// Models
import { UserPowerLevel } from '@hub-client/models/users/TUser';

// Types
type PowerLevelsUsers = {
	users?: Record<string, number>;
	users_default?: number;
};

type PowerLevelsContent = PowerLevelsUsers & {
	events?: Record<string, number>;
	state_default?: number;
};

type StateEventLike = {
	type: string;
	content?: unknown;
};

/**
 * Finds the m.room.power_levels content in a list of state events.
 * Works on sliding-sync state, admin API room state and anything else shaped like a state event.
 */
const findPowerLevelsContent = (stateEvents: readonly StateEventLike[] | undefined): PowerLevelsUsers | undefined =>
	stateEvents?.find((event) => event.type === EventType.RoomPowerLevels)?.content as PowerLevelsUsers | undefined;

/**
 * The power level of a user according to the Matrix spec: their explicit entry, else users_default, else 0.
 * A user without an id, or a room without power levels content, gets the default user level.
 * Only correct up to room version 11 (rooms are created with Synapse's default, 10): from v12 on, room creators aren't
 * listed in users and have unlimited power. See get_user_power_level in pubhubs_hub/modules/pubhubs/_validation.py.
 */
const powerLevelOf = (content: PowerLevelsUsers | undefined, userId: string | null | undefined): number =>
	(userId ? content?.users?.[userId] : undefined) ?? content?.users_default ?? UserPowerLevel.User;

// Matrix's state_default when a power levels event leaves it out
const DEFAULT_STATE_POWER_LEVEL = 50;

/**
 * The power level needed to send a state event of the given type according to the Matrix spec.
 */
const stateEventPowerLevel = (content: PowerLevelsContent | undefined, eventType: string): number =>
	content?.events?.[eventType] ?? content?.state_default ?? DEFAULT_STATE_POWER_LEVEL;

export { findPowerLevelsContent, powerLevelOf, stateEventPowerLevel, type PowerLevelsContent, type PowerLevelsUsers };
