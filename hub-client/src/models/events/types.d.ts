export type TThread = {
	count: number;
	current_user_participated: boolean;
};

export type TRelationsProperties = {
	'm.thread'?: TThread;
};

// Timeline current event, used in emits and search to scroll to specific event
export type TCurrentEvent = {
	eventId: string;
	threadId?: string | undefined;
};

// To be implemented.
export type Unsigned = {
	age?: number;
	redacted_because?: TBaseEvent;
	transaction_id?: string;
	'm.relations'?: TRelations;
};
