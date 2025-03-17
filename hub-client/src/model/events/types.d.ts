export type TThread = {
	count: number;
	current_user_participated: boolean;
};

export type TRelationsProperties = {
	'm.thread'?: TThread;
};

// To be implemented.
export type Unsigned = {
	age?: number;
	redacted_because?: TBaseEvent;
	transaction_id?: string;
	'm.relations'?: TRelations;
};
