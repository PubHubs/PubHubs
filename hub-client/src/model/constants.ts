/**
 * Commonly used constants in the application
 */

// Relation strings that are not included in Matrix enums (yet)
enum RelationType {
	// TODO replace other occurences of these strings with this enum
	RelType = 'rel_type',
	RelatesTo = 'm.relates_to',
	InReplyTo = 'm.in_reply_to',
	Thread = 'm.thread',
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

export { RelationType, RoomEmit, OnboardingType, imageTypes, mediaTypes, fileTypes, allTypes };
