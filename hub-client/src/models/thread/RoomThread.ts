// Packages
import { TimelineEvent } from '../events/TimelineEvent';
import { Direction, type MatrixClient, type MatrixEvent, type Thread, ThreadEvent } from 'matrix-js-sdk';
import { nextTick } from 'vue';

import { Redaction, RelationType } from '@hub-client/models/constants';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { useRooms } from '@hub-client/stores/rooms';

export default class TRoomThread {
	private roomId: string;
	private eventId: string;
	private matrixThread: Thread | undefined;
	private redactedEvents: MatrixEvent[] = [];
	private eventsFetched = false;
	private _length: number | undefined = undefined;

	constructor(roomId: string, eventId: string, thread: Thread | undefined) {
		this.roomId = roomId;
		this.eventId = eventId;
		this.matrixThread = thread;
	}

	private ensureMatrixThread() {
		if (this.matrixThread) return;
		const room = useRooms().room(this.roomId);
		if (room) this.setMatrixThread(room.getOrCreateMatrixThread(this.eventId));
	}

	/**
	 * Initially not all thread-events need be loaded, so we take the value from the server
	 * This value is not reactive so after loading all events we use _length
	 */
	get length(): number {
		if (this._length !== undefined) return this._length;

		const bundled = this.matrixThread?.rootEvent?.getServerAggregatedRelation<{ count: number }>('m.thread');
		return bundled?.count ?? 0;
	}

	get isMatrixThreadSet() {
		return this.matrixThread !== undefined;
	}

	get lastEventTimeStamp(): number | undefined {
		return this.matrixThread?.replyToEvent?.getTs();
	}

	/**
	 * Initial fetching of events through the relations from the server into the SDK's cache
	 */
	public async fetchEvents(): Promise<void> {
		if (this.eventsFetched) return;

		const client = usePubhubsStore().client as MatrixClient;
		const matrixRoom = client.getRoom(this.roomId);
		if (!matrixRoom) return;

		let from: string | undefined = undefined;
		do {
			const result = await client.relations(this.roomId, this.eventId, RelationType.Thread, null, { dir: Direction.Backward, from });
			await matrixRoom.addLiveEvents(result.events, { addToState: false });
			from = result.nextBatch ?? undefined;
		} while (from);
		this.getEvents();
		this.eventsFetched = true;
	}

	/**
	 * associate matrixThread to RoomThread
	 * @param thread
	 */
	public setMatrixThread(thread: Thread) {
		this.matrixThread?.off(ThreadEvent.Update, this.getEvents);
		this.matrixThread = thread;
		thread.on(ThreadEvent.Update, this.getEvents);

		this.fetchEvents().catch(() => {});
	}

	/**
	 * Reads events from MatrixThread, maps to TimelineEvent
	 * @returns Current ThreadEvents as TimelineEvent[]
	 */
	public getEvents(): TimelineEvent[] {
		if (!this.matrixThread) return [];

		const events = this.matrixThread.liveTimeline.getEvents();

		const threadRoomId = this.matrixThread.roomId ?? '';
		const timelineEvents = events.map((x) => new TimelineEvent({ matrixEvent: x, roomId: threadRoomId, inThread: true }));

		// check for deletions
		timelineEvents.forEach((event) => {
			if (
				this.redactedEvents.find(
					(redacted) =>
						redacted.event.content?.[Redaction.Redacts] === event.matrixEvent.event.event_id &&
						redacted.event.content?.[Redaction.Reason] === Redaction.DeletedFromThread,
				)
			) {
				event.isDeleted = true;
			}
		});

		// set the length and then update the thread-length in the roomsstore
		const rooms = useRooms();
		this._length = Math.max(0, timelineEvents.filter((e) => !e.isDeleted && e.matrixEvent.event.event_id !== this.eventId).length);
		rooms.setThreadLength(this.matrixThread.roomId, this.eventId, this.length);

		// sort events by localTimestamp
		return this.sortThreadEvents(timelineEvents);
	}

	/**
	 * Adds events arrived from sliding sync into the thread
	 * @param events
	 */
	public addEvents(events: MatrixEvent[]) {
		this.ensureMatrixThread();
		this.matrixThread?.addEvents(events, false);
		nextTick(() => {
			this.getEvents();
		});
	}

	public addRedactions(redactions: MatrixEvent[]) {
		this.redactedEvents = [...this.redactedEvents, ...redactions];
		this.getEvents(); // used as refresh
	}

	/**
	 *
	 * @param eventId
	 * @returns event in current thread with eventId
	 */
	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		return this.matrixThread?.liveTimeline.getEvents()?.find((x) => x.getId() === eventId);
	}

	/**
	 * Sorts an array of events by localTimestamp
	 * @param events - Array to sort
	 */
	private sortThreadEvents(events: TimelineEvent[]): TimelineEvent[] {
		events.sort((a, b) => {
			return a.matrixEvent.localTimestamp - b.matrixEvent.localTimestamp;
		});
		return events;
	}
}
