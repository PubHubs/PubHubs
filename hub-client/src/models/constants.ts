/**
 * Commonly used constants and defaults in the application
 */

enum SystemDefaults {
	syncIntervalMS = 3000, // Sync interval in milliseconds. Experimental selection for interval. Changed it from 2000 to 1000 to load events much quickly.
	SyncTimelineLimit = 100, // Find the right balance: filtering of events needs to be done clientside, but we need the first message. In the mean time initial read should be fast.
	initialRoomTimelineLimit = 100, // Initially load less messages in the rooms: makes startup faster, but filtering on messages is client-side, so we need at least one message
	roomTimelineLimit = 500, // Subsequent pagination: can be relatively high
	initialRoomListRange = 99999, // Initial number of rooms to fetch, in the future perhaps paginate this?
	publicRoomsReload = 86_400_000, // Time to cache public rooms. Reload will be forced after creating.editing new rooms, so this can be long. Now set to one day.
	MaxNumberFileUploads = 50, // Maximum number of files that can be dropped/uploaded
	mainRoomListRange = 40, // Number of rooms to fetch during main sync, lowering this leads to rooms possibly not directly loaded. Higher values give longer initial loadingtimes.
}

// options for sliding sync
enum SlidingSyncOptions {
	byRecency = 'by_recency', // sort on most recently received event
	byNotificationLevel = 'by_notification_level', // sort on highlight_count + notification_count
	byName = 'by_name', // sort on name, forces server to use the roomcalculation
	roomList = 'roomList',
	initialRoomList = 'initalRoomList',
	mainRoomList = 'mainRoomList',
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
	RoomType = 'm.room.type',
	RoomAvatar = 'm.room.avatar',
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
	Replace = 'm.replace',
	Annotation = 'm.annotation',
	EventId = 'event_id',
}

// Redaction strings that are not included in Matrix enums
enum Redaction {
	Reason = 'reason',
	Redacts = 'redacts',
	Deleted = 'Deleted',
	DeletedFromThread = 'Deleted from thread',
	DeletedFromLibrary = 'Deleted from library',
}

// Emits must be of type string so double ""
enum RoomEmit {
	ScrollToEventId = 'scrollToEventId',
	ScrolledToEventId = 'scrolledToEventId',
	ThreadLengthChanged = 'threadLengthChanged',
}

enum ScrollPosition {
	Start = 'start',
	Center = 'center',
	End = 'end',
}

enum ScrollSelect {
	Select = 'select',
	Highlight = 'highlight',
}

enum ScrollBehavior {
	Smooth = 'smooth',
}

enum OnboardingType {
	consent = 'consent',
	full = 'full',
}

// Different roles for users in PubHubs. Add new user type here.
enum roles {
	Admin = 100,
	SuperSteward = 75,
	Steward = 50,
	Expert = 25,
	User = 0,
}

// Actions that the user can carry out
enum actions {
	Invite = 'Invite',
	StewardPanel = 'StewardPanel',
	AdminPanel = 'AdminPanel',
	MessageSteward = 'MessageSteward',
	MessageAdmin = 'MessageAdmin',
	RoomAnnouncement = 'RoomAnnouncement',
}

enum notice {
	NoticesUser = 'notices_user',
}

enum QueryParameterKey {
	EventId = 'eventid',
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

// interfaces
interface RelatedEventsOptions {
	eventType?: string;
	contentRelType?: string;
}

export {
	SystemDefaults,
	SlidingSyncOptions,
	MatrixEventType,
	MatrixType,
	RelationType,
	Redaction,
	RoomEmit,
	ScrollPosition,
	ScrollSelect,
	ScrollBehavior,
	OnboardingType,
	imageTypes,
	mediaTypes,
	fileTypes,
	allTypes,
	imageTypesExt,
	RelatedEventsOptions,
	roles,
	actions,
	QueryParameterKey,
	notice,
};
