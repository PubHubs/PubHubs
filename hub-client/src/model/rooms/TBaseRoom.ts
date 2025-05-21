export enum RoomType {
	PH_MESSAGES_DEFAULT = 'ph.messages.default',
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
}

export interface TBaseRoom {
	room_id: string;
	name?: string;
	topic?: string;
	user_txt?: string;
	room_type?: string;
}
