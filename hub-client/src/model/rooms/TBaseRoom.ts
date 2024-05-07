export enum RoomType {
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
}

export interface TBaseRoom {
	room_id: string;
	name?: string;
	topic?: string;
	user_txt?: string;
	room_type?: string;
}

// Room routes
// room route name is for private / public rooms
// secure route name is specific to secure room.
export enum RoomRouteName {
	SECURED_ROOM_ROUTE = 'secure-room',
	PUBLIC_ROOM_ROUTE = 'room',
}
