import { TBaseEvent } from './TBaseEvent';

export interface TStateEvent extends TBaseEvent {
	type: 'm.room.create' | 'm.room.name';
}
