type TYellowCardEntry = {
	reason: string;
	issued_by: string; // User ID of issuer
	issued_at: number; // Unix timestamp (ms)
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

/**
 * Room account data of the warned user, recording that they acknowledged their warning.
 * Acceptance is kept out of the state event so that only stewards need write access to the
 * warnings themselves. The timestamp identifies which warning was accepted, so a warning
 * issued after an earlier acceptance shows up again.
 */
type TYellowCardAcceptedContent = {
	issued_at: number; // `issued_at` of the accepted warning
};

export { TYellowCardAcceptedContent, TYellowCardEntry, TYellowCardEventContent, TYellowCardStateEvent };
