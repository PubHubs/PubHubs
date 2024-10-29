import { PluginProperties } from '@/store/plugins';
import { Unsigned } from './types';

/**
 * Base type for events which are based on matrix's ClientEvent.
 *
 * @see https://spec.matrix.org/v1.8/client-server-api/#room-event-format
 */
export type TBaseEvent = {
	content: Record<string, any>;
	event_id: string;
	origin_server_ts: number;
	room_id: string;
	redacts?: string;
	sender: string;
	state_key?: string;
	type: string;
	unsigned?: Unsigned;
	plugin?: PluginProperties;
};
