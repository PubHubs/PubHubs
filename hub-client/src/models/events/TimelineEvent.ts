import { RelationType } from '../constants';
import { type MatrixEvent } from 'matrix-js-sdk';

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
	private _thread: TRoomThread;
	private rooms = useRooms();
	private eventsHandler: Events = new Events();
	private _isDeleted: boolean = false;

	public constructor({ matrixEvent, roomId, inThread = false }: { matrixEvent: MatrixEvent; roomId: string; inThread?: boolean }) {
		this.matrixEvent = matrixEvent;
		this.roomId = roomId;

		this._thread = new TRoomThread(this.roomId, this.matrixEvent.getId()!, undefined);

		// calls eventhandler to adapt event to PubHubs event
		this.eventsHandler.eventRoomTimeline(this.matrixEvent, false);

		if (!inThread) {
			this.loadThread();
		}
	}

	get thread() {
		return this._thread;
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

	get threadEventThreadroot(): string | undefined {
		return this.matrixEvent.getContent()[RelationType.RelatesTo]?.[RelationType.EventId];
	}

	/**
	 * This is not reactive! Use the array in rooms.ts for reactivity
	 */
	get threadLength(): number {
		return this._thread.length;
	}

	get latestThreadEventTimestamp(): number {
		return this._thread?.lastEventTimeStamp ?? 0;
	}

	isEventInThread(eventId: string): boolean {
		return this._thread?.findEventById(eventId) !== undefined;
	}

	loadThread() {
		const room = this.rooms.room(this.roomId);
		if (!room) return;
		const eventId = this.matrixEvent.event.event_id;
		if (!eventId) return;
		const thread = room.getMatrixThread(eventId);
		if (thread) {
			this._thread.setMatrixThread(thread);
		}
	}
}

export { TimelineEvent };
