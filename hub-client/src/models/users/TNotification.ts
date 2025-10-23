// For non room related notifications room_id is undefined and type can be used as identifier
type TNotification = {
	room_id: string | undefined;
	type: TNotificationType;
	message_values: Array<string | number>;
};

enum TNotificationType {
	RemovedFromSecuredRoom = 'removed_from_secured_room',
	SoonRemovedFromSecuredRoom = 'soon_removed_from_secured_room',
	Default = 'default',
}

export { TNotification, TNotificationType };
