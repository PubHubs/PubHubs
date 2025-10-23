// Models
import { TMessageEvent } from '@hub-client/models/events/TMessageEvent';
import { TStateEvent } from '@hub-client/models/events/TStateEvent';

/**
 * A general event based on matrix's ClientEvent.
 */
export type TEvent = TStateEvent | TMessageEvent;
