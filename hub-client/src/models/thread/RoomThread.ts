// Packages
import { TimelineEvent } from '../events/TimelineEvent';
import { MatrixClient, MatrixEvent, Thread } from 'matrix-js-sdk';

import { Redaction } from '@hub-client/models/constants';

export default class TRoomThread {
	private matrixThread: Thread;
	private threadEvents: TimelineEvent[] | undefined = undefined;
	private redactedEvents: MatrixEvent[] = [];

	constructor(matrixThread: Thread) {
		this.matrixThread = matrixThread;
	}

	get length(): number {
		if (this.threadEvents) {
			return Math.max(this.threadEvents.filter((x) => !x.isDeleted).length, 1); // length does not include rootEvent
		}
		return this.matrixThread.length + 1;
	}

	/**
	 * Returns all events from the thread, taken from the livetimeline
	 * Filters out the deleted events
	 * @param matrixClient
	 * @returns
	 */
	public async getEvents(matrixClient: MatrixClient): Promise<TimelineEvent[]> {
		// get events from liveTimeline and paginate to get them all
		const events = this.matrixThread.liveTimeline.getEvents();
		while (await matrixClient.paginateEventTimeline(this.matrixThread.liveTimeline, { backwards: true, limit: 100 })) {
			events.concat(this.matrixThread.liveTimeline.getEvents());
		}

		// TODO better way of building thread-list
		// using console.trace('events voor sorted: ', events); shows that this method is called to often
		// which in the end can lead to multiple instances of the same event in the thread

		// This is a quick fix to remove duplicates
		const uniqueEvents = new Map();
		events.forEach((event) => {
			uniqueEvents.set(event.event.event_id, event); // use eventId as unique key
		});
		const timelineEvents = Array.from(uniqueEvents.values()).map((event) => new TimelineEvent(event, this.matrixThread.roomId));

		// check for deletions
		timelineEvents.forEach((event) => {
			if (this.redactedEvents.find((redacted) => redacted.event.content?.[Redaction.Redacts] === event.matrixEvent.event.event_id && redacted.event.content?.[Redaction.Reason] === Redaction.DeletedFromThread)) {
				event.isDeleted = true;
			}
		});

		// sort events by localTimestamp
		this.threadEvents = this.sortThreadEvents(timelineEvents);
		return this.threadEvents;
	}

	/**
	 * Adds events arrived from sliding sync into the thread
	 * @param events
	 */
	public addEvents(events: MatrixEvent[]) {
		this.matrixThread.addEvents(events, false);
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
		return this.matrixThread.timelineSet
			.getLiveTimeline()
			.getEvents()
			?.find((x) => x.getId() === eventId);
	}

	/**
	 * Deletes the metadata of a threadevent (that is the id of the root of the thread)
	 * @param event Event to clear data from
	 */
	public clearEventMetaData(event: MatrixEvent) {
		this.matrixThread.clearEventMetadata(event);
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
