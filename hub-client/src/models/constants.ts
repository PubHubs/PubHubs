/**
 * Commonly used constants and defaults in the application
 */

enum SystemDefaults {
	syncIntervalMS = 1000, // Sync interval in milliseconds. Experimental selection for interval. Changed it from 2000 to 1000 to load events much quickly.
	SyncTimelineLimit = 50, // Find the right balance: filtering of events needs to be done clientside, but we need the first message. In the mean time initial read should be fast.
	RoomTimelineLimit = 10, // Can be relatively high: is already filtered on messages
}

// common matrix types
enum MatrixType {
	StateKey = 'state_key',
	MemberShip = 'membership',
	IsDirect = 'is_direct',
	Join = 'join',
	Invite = 'invite',
}

// Eventtypes that are not covered by Matrix Constants
enum MatrixEventType {
	RoomName = 'm.room.name',
	RoomAvatar = 'm.room.avatar',
	RoomTopic = 'm.room.topic',
	RoomMember = 'm.room.member',
	RoomMessage = 'm.room.message',
	RoomRedaction = 'm.room.redaction',
}

// Relation strings that are not included in Matrix enums (yet)
enum RelationType {
	// TODO replace other occurences of these strings with this enum
	RelType = 'rel_type',
	RelatesTo = 'm.relates_to',
	InReplyTo = 'm.in_reply_to',
	Thread = 'm.thread',
	EventId = 'event_id',
}

// Redaction strings that are not included in Matrix enums
enum Redaction {
	Reason = 'reason',
	Redacts = 'redacts',
	Deleted = 'Deleted',
	DeletedFromThread = 'Deleted from thread',
}

// Emits must be of type string so double ""
enum RoomEmit {
	ScrollToEventId = 'scrollToEventId',
	ScrolledToEventId = 'scrolledToEventId',
	ThreadLengthChanged = 'threadLengthChanged',
}

enum OnboardingType {
	consent = 'consent',
	full = 'full',
}

// File types
const imageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg'];
const imageTypesExt = ['png', 'jpeg', 'jpg', 'gif', 'svg'];
const mediaTypes = ['audio/wave', 'audio/wav', 'audio/x-wav', 'audio/x-pn-wav', 'audio/webm', 'video/webm', 'audio/ogg', 'video/ogg', 'application/ogg'];
const fileTypes = [
	'application/pdf',
	'application/txt',
	'text/plain',
	'application/vnd.oasis.opendocument.presentation',
	'application/vnd.oasis.opendocument.text',
	'application/vnd.ms-powerpoint',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation',
	'application/rtf',
	'application/vnd.ms-excel',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	'application/zip',
	'text/calendar',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'text/csv',
];

const allTypes = [...imageTypes, ...mediaTypes, ...fileTypes];

export { SystemDefaults, MatrixEventType, MatrixType, RelationType, Redaction, RoomEmit, OnboardingType, imageTypes, mediaTypes, fileTypes, allTypes, imageTypesExt };
