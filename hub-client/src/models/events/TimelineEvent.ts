import { RelationType } from '../constants';
import { MatrixEvent } from 'matrix-js-sdk';

import { Events } from '@hub-client/logic/core/events';

import TRoomThread from '@hub-client/models/thread/RoomThread';

import { useRooms } from '@hub-client/stores/rooms';

/**
 * Wrapper for events used in the timeline and the threads
 * Adapts events to PubHubs format
 * includes threadinfo
 */
class TimelineEvent {
	public matrixEvent: MatrixEvent;

	private roomId: string;
	private thread: TRoomThread | undefined;
	private rooms = useRooms();
	private eventsHandler: Events = new Events();
	private _isDeleted: boolean = false;

	public constructor(matrixEvent: MatrixEvent, roomId: string) {
		this.matrixEvent = matrixEvent;
		this.roomId = roomId;

		// calls eventhandler to adapt event to PubHubs event
		this.eventsHandler.eventRoomTimeline(this.matrixEvent, false);

		// load the thread if this event is a root of a thread, this is an async call, but we don't await it here
		this.loadThread();
	}

	set isDeleted(value: boolean) {
		this._isDeleted = value;
	}

	get isDeleted(): boolean {
		return this._isDeleted;
	}

	get isThreadRoot(): boolean {
		return this.matrixEvent.isThreadRoot;
	}

	get isThreadEvent(): boolean {
		return this.matrixEvent.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread;
	}

	get threadLength(): number {
		return this.thread?.length ?? 0;
	}

	get threadEventThreadroot(): string | undefined {
		return this.matrixEvent.getContent()[RelationType.RelatesTo]?.[RelationType.EventId];
	}

	private async loadThread() {
		const room = this.rooms.room(this.roomId);
		if (!room) return;
		this.thread = room.getThread(this.matrixEvent.event.event_id!);
	}
}

export { TimelineEvent };
