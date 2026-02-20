/**
 * Commonly used constants and defaults in the application
 */

enum SystemDefaults {
	syncIntervalMS = 3000, // Sync interval in milliseconds. Experimental selection for interval. Changed it from 2000 to 1000 to load events much quickly.
	SyncTimelineLimit = 100, // Find the right balance: filtering of events needs to be done clientside, but we need the first message. In the mean time initial read should be fast.
	initialRoomTimelineLimit = 50, // Initially load less messages in the rooms: makes startup faster, but filtering on messages is client-side, so we need at least one message
	roomTimelineLimit = 100, // Max messages in the sliding window
	paginationBatchSize = 50, // Messages to fetch per pagination
	initialRoomListRange = 99999, // Initial number of rooms to fetch, in the future perhaps paginate this?
	publicRoomsReload = 86_400_000, // Time to cache public rooms. Reload will be forced after creating.editing new rooms, so this can be long. Now set to one day.
	MaxNumberFileUploads = 50, // Maximum number of files that can be dropped/uploaded
	mainRoomListRange = 40, // Number of rooms to fetch during main sync, lowering this leads to rooms possibly not directly loaded. Higher values give longer initial loadingtimes.
	longPressDuration = 250, // Amount of milliseconds for a long-press
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
	RoomReceipt = 'm.room.receipt',
	RoomReadMarker = 'm.room.read_markers',
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
	TopWithPadding = 'topWithPadding',
}

enum ScrollSelect {
	Select = 'select',
	Highlight = 'highlight',
}

enum ScrollBehavior {
	Smooth = 'smooth',
	Auto = 'auto',
}

/**
 * Timeline scroll constants
 *
 * Used by useTimelineScroll, useReadMarker, and useTimelinePagination composables.
 */
const TimelineScrollConstants = {
	SCROLL_THRESHOLD: 50, // Pixels from scrollTop=0 to be considered "at newest"
	SCROLL_DEBOUNCE: 100, // Milliseconds to debounce scroll events
	SCROLL_DURATION: 300, // Milliseconds for smooth scroll animation duration
	READ_DELAY_MS: 1000, // Milliseconds message must be visible to mark as read
	PAGINATION_COOLDOWN: 100, // Milliseconds before re-enabling pagination observer after load
	TOP_PADDING: 80, // Padding from visual top when using TopWithPadding scroll position
} as const;

enum OnboardingType {
	consent = 'consent',
	full = 'full',
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
	TimelineScrollConstants,
	OnboardingType,
	imageTypes,
	mediaTypes,
	fileTypes,
	allTypes,
	imageTypesExt,
	RelatedEventsOptions,
	QueryParameterKey,
	notice,
};
