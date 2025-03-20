import { MatrixEvent, MatrixClient, Thread } from 'matrix-js-sdk';

export default class TRoomThread {
	private matrixThread: Thread;

	constructor(matrixThread: Thread) {
		this.matrixThread = matrixThread;
	}

	public async getEvents(matrixClient: MatrixClient): Promise<MatrixEvent[]> {
		// get events from liveTimeline and paginate to get them all
		let events = this.matrixThread.liveTimeline.getEvents();
		while (await matrixClient.paginateEventTimeline(this.matrixThread.liveTimeline, { backwards: true, limit: 100 })) {
			events.concat(this.matrixThread.liveTimeline.getEvents());
		}

		// TODO better way of building thread-list
		// using console.trace('events voor sorted: ', events); shows that this methd is called to often which in the end can lead
		// to multiple instances of the same event in the thread
		// This is a quick fix to remove duplicates
		const uniqueEvents = new Map();
		events.forEach((event) => {
			uniqueEvents.set(event.event.event_id, event); // use eventId as unique key
		});
		events = Array.from(uniqueEvents.values());

		// sort events by localTimestamp
		return this.sortThreadEvents(events);
	}

	public getLength(): number {
		return this.matrixThread.liveTimeline.getEvents().length;
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
	private sortThreadEvents(events: MatrixEvent[]): MatrixEvent[] {
		events.sort((a, b) => {
			return a.localTimestamp - b.localTimestamp;
		});
		return events;
	}
}
