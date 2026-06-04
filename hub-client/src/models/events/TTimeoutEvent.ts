type TTimeoutEntry = {
	timeout_until: number; // Unix timestamp (ms) when timeout expires
	reason: string;
	issued_by: string; // User ID of issuer
	issued_at: number; // Unix timestamp (ms)
};

type TTimeoutEventContent = {
	timeouts: Record<string, TTimeoutEntry>; // Map of userId -> timeout info
};

type TTimeoutStateEvent = {
	type: 'pubhubs.timeout';
	state_key: ''; // Always empty string
	content: TTimeoutEventContent;
	sender: string;
	origin_server_ts: number;
	event_id: string;
	room_id: string;
};

export { TTimeoutEntry, TTimeoutEventContent, TTimeoutStateEvent };
