import { MatrixClient, MatrixEvent, Room as MatrixRoom, Direction, EventTimeline, TimelineWindow, Filter } from 'matrix-js-sdk';
import { LOGGER } from '@/dev/Logger';
import { SMI } from '@/dev/StatusMessage';
import { TBaseEvent } from '../model';

const PAGE_SIZE = 96;

/*
	The Matrix SDK keeps its events in EventTimelines that are coupled in EventTimelineSets. 
	There is one special EventTimeline which is the LiveTimeline that keeps track of all the new events that take place inside the room.
	To give a chronological overview of the events you would have to jump across timelines and timelinesets to find all neighbouring events.

	In the Matrix SDK there is the TimelineWindow class which gives a window view on the events of the room, with filter options and pagination.
	Our RoomTimelineWindow extends on that class.
	Before using the RoomTimelineWindow it always needs to be initialized, using initTimelineWindow.
*/

class RoomTimelineWindow {
	private timelineWindow: TimelineWindow | undefined;

	/* event filters: which events are to be shown in the timelineWindow */
	private visibleEventTypes = ['m.room.message'];
	private invisibleMessageTypes = ['m.notice'];
	private timelineSetFilter = {
		room: {
			timeline: {
				types: ['m.room.message'],
			},
		},
	};

	logger = LOGGER;

	// Initialisation of a timeline window
	public async initTimelineWindow(matrixRoom: MatrixRoom, client: MatrixClient) {
		LOGGER.log(SMI.ROOM_TIMELINEWINDOW_TRACE, `initTimelineWindow...`, { roomId: matrixRoom.roomId });
		const filter = new Filter(undefined);
		filter.setDefinition(this.timelineSetFilter);
		const filteredTimelineSet = matrixRoom.getOrCreateFilteredTimelineSet(filter);

		this.timelineWindow = new TimelineWindow(client, filteredTimelineSet);
		this.loadToEvent(undefined);

		// loadToEvent when given undefined as parameter goes to the Livetimeline which is unfiltered so afterwards
		// we need to check if we have enough filtered results already and when necessary load some more
		if (this.timelineWindow.getEvents().length < PAGE_SIZE && this.timelineWindow.canPaginate(EventTimeline.BACKWARDS)) {
			const currentEvents = this.timelineWindow.getEvents();
			const lastEvent = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1] : undefined;
			await this.paginate(EventTimeline.BACKWARDS);
			await this.loadToEvent(lastEvent?.event.event_id);
		}

		LOGGER.log(SMI.ROOM_TIMELINEWINDOW_TRACE, `initTimelineWindow done`, { roomId: matrixRoom.roomId, timeline: this.getTimeline() });
	}

	// filtering happens in two stages: serverside by the filter on the timelineset and clientside on the type of message
	// this returns if a message is visible or not
	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		if (!this.visibleEventTypes.includes(event.type as string)) return false;
		if (event.content?.msgtype) {
			if (this.invisibleMessageTypes.includes(event.content?.msgtype)) return false;
		}
		return true;
	}

	// the filtered timeline contains all messages, so they need some filtering added that can not be done on the server
	public getTimeline() {
		return this.timelineWindow?.getEvents()?.filter((event) => this.isVisibleEvent(event.event));
	}

	public isOldestMessageLoaded(): boolean {
		if (this.timelineWindow) {
			return !this.timelineWindow.canPaginate(EventTimeline.BACKWARDS);
		}
		return false;
	}

	public isNewestMessageLoaded(): boolean {
		if (this.timelineWindow) {
			return !this.timelineWindow.canPaginate(EventTimeline.FORWARDS);
		}
		return false;
	}

	private async performPaginate(direction: Direction) {
		if (this.timelineWindow) {
			// paginate
			while (this.timelineWindow?.canPaginate(direction) && (this.getTimeline()?.length ?? 0) <= PAGE_SIZE) {
				// the API call returns all filtered messages, not only the visible messages
				// to minimize the number of API calls we load more than PAGE_SIZE at a time
				await this.timelineWindow.paginate(direction, PAGE_SIZE * 2);
			}
			// //unpaginate the superfluous number of messages
			while ((this.getTimeline()?.length ?? 0) - PAGE_SIZE > 0) {
				this.timelineWindow.unpaginate(1, direction === EventTimeline.FORWARDS);
			}
		}
	}

	public async paginate(direction: Direction) {
		if (this.timelineWindow) {
			await this.performPaginate(direction);
		}
	}

	public async loadToEvent(eventId: string | undefined) {
		this.logger.log(SMI.ROOM_TIMELINEWINDOW_TRACE, `Loading to event ${eventId}...`, { eventId });
		if (this.timelineWindow) {
			await this.timelineWindow.load(eventId, PAGE_SIZE);
		}
	}

	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		this.logger.log(SMI.ROOM_TIMELINEWINDOW_TRACE, `find by eventId ${eventId}...`, { eventId });
		return this.timelineWindow?.getEvents()?.find((x) => x.event.event_id === eventId);
	}
}

export { RoomTimelineWindow };
