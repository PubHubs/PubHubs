import { RelationType } from '../constants';
import { MatrixEvent } from 'matrix-js-sdk';
import { ref } from 'vue';

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
	public threadLength = ref(0);

	private roomId: string;
	private _thread: TRoomThread = new TRoomThread(undefined);
	private rooms = useRooms();
	private eventsHandler: Events = new Events();
	private _isDeleted: boolean = false;

	public constructor({ matrixEvent, roomId, inThread = false }: { matrixEvent: MatrixEvent; roomId: string; inThread?: boolean }) {
		this.matrixEvent = matrixEvent;
		this.roomId = roomId;

		// calls eventhandler to adapt event to PubHubs event
		this.eventsHandler.eventRoomTimeline(this.matrixEvent, false);

		// if this event is a root of a thread: load the thread, make the callbackfunction for length reactivity
		if (!inThread) {
			this.loadThread();

			this.threadLength.value = this.thread?.length ?? 0;
			// set a listener on the threadlength for when it changes. so the ref field can pass it to the vue components
			this.thread?.onLengthChange(() => {
				if (!this.thread.isMatrixThreadSet && matrixEvent.event.event_id) {
					const room = useRooms()?.room(roomId);
					if (room) {
						this._thread.setMatrixThread(room.getOrCreateMatrixThread(matrixEvent.event.event_id));
					}
				}
				this.threadLength.value = this.thread?.length ?? 0;
			});
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
		return this._thread !== undefined;
	}

	get isThreadEvent(): boolean {
		return this.matrixEvent.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread;
	}

	get threadEventThreadroot(): string | undefined {
		return this.matrixEvent.getContent()[RelationType.RelatesTo]?.[RelationType.EventId];
	}

	isEventInThread(eventId: string): boolean {
		return this._thread?.findEventById(eventId) !== undefined;
	}

	async loadThread() {
		const room = this.rooms.room(this.roomId);
		if (!room) return;
		const thread = room.getMatrixThread(this.matrixEvent.event.event_id!);
		if (thread) {
			this._thread.setMatrixThread(thread);
		}
	}
}

export { TimelineEvent };
