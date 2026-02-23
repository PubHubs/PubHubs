// Packages
import { TimelineEvent } from '../events/TimelineEvent';
import { MatrixClient, MatrixEvent, Thread } from 'matrix-js-sdk';

import { Redaction } from '@hub-client/models/constants';

import { usePubhubsStore } from '@hub-client/stores/pubhubs';

export default class TRoomThread {
	private matrixThread: Thread | undefined;
	private threadEvents: TimelineEvent[] | undefined = undefined;
	private redactedEvents: MatrixEvent[] = [];
	private listeners = new Set<() => void>();
	private pubhubsStore = usePubhubsStore();

	constructor(matrixThread: Thread | undefined) {
		this.matrixThread = matrixThread;
	}

	/**
	 * adds a listener with a callbackfunction
	 */
	onLengthChange(callback: () => void) {
		this.listeners.add(callback);
	}

	public notifyLengthChange() {
		this.listeners.forEach((cbf) => cbf());
	}

	get length(): number {
		if (this.threadEvents) {
			return Math.max(this.threadEvents.filter((x) => !x.isDeleted).length, 1); // length does not include rootEvent
		}
		return this.matrixThread?.events.length ?? 0;
	}

	get isMatrixThreadSet() {
		return this.matrixThread !== undefined;
	}

	public setMatrixThread(thread: Thread) {
		this.matrixThread = thread;
		this.getEvents(this.pubhubsStore.client as MatrixClient); // to initialize with the correct number of events
	}

	/**
	 * Returns all events from the thread, taken from the livetimeline
	 * Filters out the deleted events
	 * @param matrixClient
	 * @returns
	 */
	public async getEvents(matrixClient: MatrixClient): Promise<TimelineEvent[]> {
		if (!this.matrixThread) {
			this.notifyLengthChange();
			return [];
		}

		// get events from liveTimeline and paginate to get them all
		const events = this.matrixThread.liveTimeline.getEvents();
		while (await matrixClient.paginateEventTimeline(this.matrixThread.liveTimeline, { backwards: true, limit: 100 })) {
			events.concat(this.matrixThread.liveTimeline.getEvents());
		}

		// TODO better way of building thread-list
		// using console.trace('events voor sorted: ', events); shows that this method is called to often
		// which in the end can lead to multiple instances of the same event in the thread

		// add events to current timelineEvents and filter unique events
		let timelineEvents = events.map((x) => new TimelineEvent({ matrixEvent: x, roomId: this.matrixThread!.roomId, inThread: true }));
		timelineEvents = [...(this.threadEvents ?? []), ...timelineEvents];

		// filter unique events
		const uniqueEvents = new Map<string, TimelineEvent>();
		timelineEvents.forEach((event) => uniqueEvents.set(event.matrixEvent.event.event_id!, event));
		timelineEvents = Array.from(uniqueEvents.values());

		// check for deletions
		timelineEvents.forEach((event) => {
			if (this.redactedEvents.find((redacted) => redacted.event.content?.[Redaction.Redacts] === event.matrixEvent.event.event_id && redacted.event.content?.[Redaction.Reason] === Redaction.DeletedFromThread)) {
				event.isDeleted = true;
			}
		});

		// sort events by localTimestamp
		this.threadEvents = this.sortThreadEvents(timelineEvents);
		this.notifyLengthChange();
		return this.threadEvents;
	}

	/**
	 * Adds events arrived from sliding sync into the thread
	 * @param events
	 */
	public addEvents(events: MatrixEvent[]) {
		this.matrixThread?.addEvents(events, false);
		this.notifyLengthChange();
	}

	public addRedactions(redactions: MatrixEvent[]) {
		this.redactedEvents = [...this.redactedEvents, ...redactions];
	}

	/**
	 *
	 * @param eventId
	 * @returns event in current thread with eventId
	 */
	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		return this.matrixThread?.timelineSet
			.getLiveTimeline()
			.getEvents()
			?.find((x) => x.getId() === eventId);
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
