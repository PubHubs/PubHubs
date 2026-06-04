type TYellowCardEntry = {
	reason: string;
	issued_by: string; // User ID of issuer
	issued_at: number; // Unix timestamp (ms)
	dismissed: boolean; // Whether user has acknowledged
};

type TYellowCardEventContent = {
	warnings: Record<string, TYellowCardEntry>; // Map of userId -> warning info
};

type TYellowCardStateEvent = {
	type: 'pubhubs.yellow_card';
	state_key: ''; // Always empty string
	content: TYellowCardEventContent;
	sender: string;
	origin_server_ts: number;
	event_id: string;
	room_id: string;
};

export { TYellowCardEntry, TYellowCardEventContent, TYellowCardStateEvent };
