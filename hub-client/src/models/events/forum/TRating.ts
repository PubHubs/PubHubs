export type TRating = {
	'm.relates_to': {
		rel_type: string;
		event_id: string;
		key: string;
	};
	eventId: string;
	author: string;
	body: string;
	timestamp: number;
};
