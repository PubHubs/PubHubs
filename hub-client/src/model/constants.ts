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

export { RelationType, RoomEmit, OnboardingType };
