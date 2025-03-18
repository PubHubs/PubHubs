import { MatrixEvent, MatrixClient, Thread } from 'matrix-js-sdk';
import { RelationType } from '../constants';

export default class TRoomThread {
	private matrixThread: Thread;

	constructor(matrixThread: Thread) {
		this.matrixThread = matrixThread;
	}

	public async getEvents(matrixClient: MatrixClient): Promise<MatrixEvent[]> {
		const events = this.matrixThread.liveTimeline.getEvents();
		while (await matrixClient.paginateEventTimeline(this.matrixThread.liveTimeline, { backwards: true, limit: 100 })) {
			events.concat(this.matrixThread.liveTimeline.getEvents());
		}
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
	 * Sorts an array of events so that the root of the thread is first
	 * A rootevent does not have a relationtype of m.thread
	 * @param events - Array to sort
	 */
	private sortThreadEvents(events: MatrixEvent[]): MatrixEvent[] {
		events.sort((a, b) => {
			const aIsRoot = a.event.content?.[RelationType.RelatesTo] ? [RelationType.RelType].toString() === RelationType.Thread : true;
			const bIsRoot = b.event.content?.[RelationType.RelatesTo] ? [RelationType.RelType].toString() === RelationType.Thread : true;
			if (aIsRoot && !bIsRoot) {
				return -1;
			}
			if (!aIsRoot && bIsRoot) {
				return 1;
			}
			return 0;
		});
		return events;
	}
}
