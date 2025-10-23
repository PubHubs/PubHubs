// Models
import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';

export interface TStateEvent extends TBaseEvent {
	type: 'm.room.create' | 'm.room.history_visibility' | 'm.room.join_rules' | 'm.room.member' | 'm.room.name' | 'm.room.power_levels' | 'm.room.topic' | 'm.room.canonical_alias';
	age: number;
	user_id: string;
}
export interface TRoomCreate extends TStateEvent {
	type: 'm.room.create';
	content: {
		room_version: string;
		creator: string;
	};
}

interface TRoomVisibleHistory extends TStateEvent {
	type: 'm.room.history_visibility';
	content: {
		history_visibility: string;
	};
}

interface TRoomJoinRules extends TStateEvent {
	type: 'm.room.join_rules';
	content: {
		join_rule: string;
	};
}

interface TRoomMemberEvent extends TStateEvent {
	type: 'm.room.member';
	content: {
		displayname: string;
		membership: string;
	};
}

interface TRoomName extends TStateEvent {
	type: 'm.room.name';
	content: {
		name: string;
	};
}

// Power Level content type

interface PowerLevelsContent {
	users: Record<string, number>; // A record of user IDs and their power levels
	users_default: number; // Default power level for users
	events: Record<string, number>; // A record of event types and their power levels
	events_default: number; // Default power level for events
	state_default: number; // Default state power level
	ban: number; // Power level for banning
	kick: number; // Power level for kicking
	redact: number; // Power level for redaction
	invite: number; // Power level for inviting
	historical: number; // Power level for historical events
	m_call_invite: number; // Power level for call invites
}

interface TRoomPowerLevels extends TStateEvent {
	type: 'm.room.power_levels';
	content: PowerLevelsContent; // Contains
}

interface TRoomTopic extends TStateEvent {
	type: 'm.room.topic';
	content: {
		topic: string;
	};
}

interface TRoomCanonicalAlias extends TStateEvent {
	type: 'm.room.canonical_alias';
	content: {
		alias: string;
	};
}

// State Response that can by used in admin room state api.
export interface TState {
	state: (TRoomCreate | TRoomVisibleHistory | TRoomJoinRules | TRoomMemberEvent | TRoomName | TRoomPowerLevels | TRoomTopic | TRoomCanonicalAlias)[];
}
