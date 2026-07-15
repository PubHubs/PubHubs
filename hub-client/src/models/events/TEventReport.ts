type TEventReport = {
	id: number;
	event_id: string;
	room_id: string;
	name: string | null;
	canonical_alias: string | null;
	sender: string;
	user_id: string;
	reason: string | null;
	score: number | null;
	received_ts: number;
};

type TEventReportDetail = TEventReport & {
	event_json: Record<string, unknown> | null;
};

type TEventReportsResponse = {
	event_reports: TEventReport[];
	next_token?: number;
	total: number;
};

export type { TEventReport, TEventReportDetail, TEventReportsResponse };
