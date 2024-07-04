export type TSearchResult = {
	rank: number;
	event_id: string;
	event_type: string;
	event_body: string;
	event_sender: string;
};

export type TSearchParameters = {
	term: string;
	roomId: string;
};
