export enum RoomType {
	PH_MESSAGES_DEFAULT = 'ph.messages.default',
	PH_MESSAGES_RESTRICTED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
	PH_MESSAGE_ADMIN_CONTACT = 'ph.messages.admin.contact',
	PH_MESSAGE_STEWARD_CONTACT = 'ph.messages.steward.contact',
}

export interface TBaseRoom {
	room_id: string;
	name?: string;
	topic?: string;
	user_txt?: string;
	room_type?: string;
}
