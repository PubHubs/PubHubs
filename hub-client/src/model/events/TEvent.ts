import { TStateEvent } from './TStateEvent';
import { TMessageEvent } from './TMessageEvent';

/**
 * A general event based on matrix's ClientEvent.
 */
export type TEvent = TStateEvent | TMessageEvent;
