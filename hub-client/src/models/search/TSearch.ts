export type TSearchResult = {
	rank: number;
	event_id: string;
	event_threadId: string | undefined;
	event_type: string;
	event_body: string;
	event_sender: string;
	event_timestamp: number;
};

export type TSearchParameters = {
	term: string;
	roomId: string;
};
