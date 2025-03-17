/**
 * Commonly used constants in the application
 */

// Relation strings that are not included in Matrix enums (yet)
enum RelationType {
	// TODO replace other occurences of these strings with this enum
	RelatesTo = 'm.relates_to',
	InReplyTo = 'm.in_reply_to',
}

// Emits must be of type string so double ""
enum RoomEmit {
	ScrollToEventId = 'scrollToEventId',
	ScrolledToEventId = 'scrolledToEventId',
	ThreadLengthChanged = 'threadLengthChanged',
}

export { RelationType, RoomEmit };
