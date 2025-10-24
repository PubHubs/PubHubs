import { TBaseEvent } from '../events/TBaseEvent';
import { RedactReasons } from '@/logic/core/events';
import { LOGGER } from '@/logic/foundation/Logger';
import { SMI } from '@/logic/foundation/StatusMessage';
import { Direction, EventTimeline, EventType, Filter, MatrixClient, MatrixEvent, Room as MatrixRoom, MsgType, TimelineWindow } from 'matrix-js-sdk';

const PAGE_SIZE = 96;
const FILTER_ID = 'MainRoomTimeline';
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
	private redactedEventIds: string[] = [];

	/* event filters: which events are to be shown in the timelineWindow */
	private visibleEventTypes: string[] = [EventType.RoomMessage, EventType.Reaction];
	private invisibleMessageTypes: string[] = [MsgType.Notice];
	private timelineSetFilter = {
		room: {
			timeline: {
				types: [EventType.RoomMessage, EventType.RoomRedaction, EventType.Reaction],
			},
		},
	};

	logger = LOGGER;

	FILTER_ID = 'MainRoomTimeline';

	constructor(matrixRoom: MatrixRoom) {
		LOGGER.trace(SMI.ROOM_TIMELINEWINDOW, `TimelineWindow constructor `, {
			roomId: matrixRoom.roomId,
		});
		/* To init? */
		// const filter = new Filter(undefined);
		// filter.setDefinition(this.timelineSetFilter);
		// const filteredTimelineSet = matrixRoom.getOrCreateFilteredTimelineSet(filter);

		// this.timelineWindow = new TimelineWindow(client, filteredTimelineSet);
		/* */
	}

	// Initialisation of a timeline window
	public async initTimelineWindow(matrixRoom: MatrixRoom, client: MatrixClient) {
		LOGGER.trace(SMI.ROOM_TIMELINEWINDOW, `initTimelineWindow...`, {
			roomId: matrixRoom.roomId,
		});
		/* to constructor? */
		const filter = new Filter(undefined, FILTER_ID);
		filter.setDefinition(this.timelineSetFilter);
		const filteredTimelineSet = matrixRoom.getOrCreateFilteredTimelineSet(filter);

		this.timelineWindow = new TimelineWindow(client, filteredTimelineSet);
		this.timelineWindow.load(undefined);

		// load with undefined as parameter goes to the Livetimeline which is unfiltered so afterwards
		// we need to check if we have enough filtered results already and when necessary load some more
		if (this.timelineWindow && this.timelineWindow.getEvents().length < PAGE_SIZE && this.timelineWindow.canPaginate(EventTimeline.BACKWARDS)) {
			const currentEvents = this.timelineWindow.getEvents();
			const lastEvent = currentEvents.length > 0 ? currentEvents[currentEvents.length - 1] : undefined;
			await this.paginate(EventTimeline.BACKWARDS);
			await this.loadToEvent(lastEvent?.event.event_id);
		}

		LOGGER.trace(SMI.ROOM_TIMELINEWINDOW, `initTimelineWindow done`, {
			roomId: matrixRoom.roomId,
			timeline: this.getTimeline(),
		});
	}

	// filtering happens in two stages: serverside by the filter on the timelineset and clientside on the type of message
	// this returns if a message is visible or not
	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		if (event.type && !this.visibleEventTypes.includes(event.type)) {
			return false;
		}
		if (event.content?.msgtype) {
			if (this.invisibleMessageTypes.includes(event.content?.msgtype)) {
				return false;
			}
		}
		// Deleted events from threads may not be visible: they have lost the direct connection to their thread
		if (event.unsigned?.redacted_because?.redacts) {
			if (event.unsigned?.redacted_because?.content.reason === RedactReasons.DeletedFromThread) {
				return false;
			}
		}
		return true;
	}

	// the filtered timeline contains all messages, so they need some filtering added that can not be done on the server
	public getTimeline(): MatrixEvent[] {
		LOGGER.trace(SMI.ROOM_TIMELINEWINDOW, `RoomtimelineWindow gettimeline `, {
			getEvents: this.timelineWindow?.getEvents(),
		});
		return this.timelineWindow?.getEvents()?.filter((event) => this.isVisibleEvent(event.event)) || [];
	}

	public getRedactedEventIds() {
		return this.redactedEventIds;
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
		this.logger.trace(SMI.ROOM_TIMELINEWINDOW, `Loading to event ${eventId}...`, { eventId });
		if (this.timelineWindow) {
			await this.timelineWindow.load(eventId, PAGE_SIZE);
		}
	}

	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		this.logger.trace(SMI.ROOM_TIMELINEWINDOW, `find by eventId ${eventId}...`, { eventId });
		return this.timelineWindow?.getEvents()?.find((x) => x.event.event_id === eventId);
	}
}

export { RoomTimelineWindow };
