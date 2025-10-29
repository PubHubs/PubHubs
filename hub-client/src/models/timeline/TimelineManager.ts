// Packages
import { Direction, EventTimeline, EventType, Filter, MatrixClient, MatrixEvent, MsgType } from 'matrix-js-sdk';

// Stores
import { useMatrix } from '@hub-client/composables/matrix.composable';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { MatrixEventType, Redaction, RelationType, SystemDefaults } from '@hub-client/models/constants';
import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { TCurrentEvent } from '@hub-client/models/events/types';

// Stores
import { useUser } from '@hub-client/stores/user';

// Types
type TPaginationState = {
	/** The first message of the total timeline */
	firstMessageId: string | undefined;
	/** The last message of the total timeline */
	lastMessageId: string | undefined;
};

/**
 * TimelineManager
 * Fetches and filters events from the timeline
 */
class TimelineManager {
	// Keeps track of the last paginationstate for both directions
	private paginationState: TPaginationState = {
		firstMessageId: undefined,
		lastMessageId: undefined,
	};

	private user = useUser();
	private client: MatrixClient;

	/** Contains the current filtered timelineevents */
	private timelineEvents: TimelineEvent[] = [];
	/** Contains all related events of the current timelineEvents */
	private relatedEvents: TimelineEvent[] = [];
	/** Contains all redacted events coming from sliding sync */
	private redactedEvents: TimelineEvent[] = [];

	private roomId: string;

	private redactedEventIds: string[] = [];

	/** roomTimelineKey of the sliding sync subscription of this timelinemanager */
	private roomTimelineKey: string | undefined;

	// Added Room Member to get the avatar value when change happen
	private visibleEventTypes: string[] = [EventType.RoomMessage];
	private invisibleMessageTypes: string[] = [MsgType.Notice];
	private invisibleRelatesToTypes: string[] = [RelationType.Thread];
	private timelineSetFilter = {
		room: {
			timeline: {
				types: [EventType.RoomMessage, EventType.RoomRedaction],
			},
		},
	};

	private readonly relatedEventTypes = new Set([PubHubsMgType.VotingWidgetReply, PubHubsMgType.VotingWidgetClose, PubHubsMgType.VotingWidgetModify, PubHubsMgType.VotingWidgetPickOption, EventType.Reaction]);

	private FILTER_ID: string = 'MainRoomTimeline';

	constructor(roomId: string, client: MatrixClient) {
		this.roomId = roomId;
		this.client = client;
	}

	/**
	 * Check if an event should be visible in the timeline
	 * @param event event to check
	 * @returns true if the event should be visible, false otherwise
	 */
	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		if (event.type && !this.visibleEventTypes.includes(event.type)) {
			return false;
		}
		if (event.content?.msgtype) {
			if (this.invisibleMessageTypes.includes(event.content?.msgtype)) {
				return false;
			}
		}
		if (this.invisibleRelatesToTypes.includes(event.content?.[RelationType.RelatesTo]?.rel_type)) {
			return false;
		}
		// Deleted events from threads may not be visible; they have lost the direct connection to their thread
		if (event.unsigned?.redacted_because?.redacts) {
			if (event.unsigned?.redacted_because?.content.reason === Redaction.DeletedFromThread) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Initializes the timeline for a room: subscribes to the room in sliding sync and starts syncing
	 * @param roomId Id of the room to initialize the timeline for
	 */
	initRoomTimeline(roomId: string) {
		const matrix = useMatrix();

		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Initializing timeline for room ${roomId}`);
		this.roomId = roomId;
		if (!this.roomTimelineKey) {
			this.roomTimelineKey = matrix.addRoomSubscription(roomId);
		}
		matrix.syncRooms();
	}

	/**
	 * Prepares the events for use in the room timeline: filters isVisible and sorts
	 * @param eventList eventlist coming from Sliding sync, to be prepared for use
	 * @returns eventList to use in the RoomTimeline
	 */
	prepareEvents(eventList: MatrixEvent[]): MatrixEvent[] {
		return eventList.filter((event) => this.isVisibleEvent(event.event)).sort((a, b) => a.getTs() - b.getTs());
	}

	/**
	 * Gets all related events from the given timelineevents
	 * @returns all related events
	 */
	private async getRelatedEvents(events: TimelineEvent[]): Promise<TimelineEvent[]> {
		let allRelatedEvents: MatrixEvent[] = [];
		let nextBatch: string | undefined = undefined;
		for (const e of events) {
			do {
				const result = await this.client.relations(this.roomId, e.matrixEvent.event.event_id!, null, null, { from: nextBatch });
				allRelatedEvents.push(...result.events);
				nextBatch = result.nextBatch ?? undefined;
			} while (nextBatch);
		}

		// filter out all relations that have no content['m.relates_to'] field (like the matrix SDK does) or that have thread-content (threads are handled in API)
		allRelatedEvents = allRelatedEvents.filter((x) => typeof x.event?.content?.[RelationType.RelatesTo] === 'object' && x.event.content[RelationType.RelatesTo][RelationType.RelType] !== RelationType.Thread);

		return allRelatedEvents.map((x) => new TimelineEvent(x, this.roomId));
	}

	// To get the related event for main event.
	public getRelatedEventForEvent(eventId: string): MatrixEvent[] {
		return this.getTimeLineRelatedEvents()
			.filter((event) => {
				return event.matrixEvent.getContent()[RelationType.RelatesTo]?.event_id === eventId;
			})
			.map((event) => event.matrixEvent);
	}

	/**
	 * actual adding of events to the timeline
	 * @param eventList List of events to add
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	private async addEventList(eventList: TimelineEvent[]): Promise<string | undefined> {
		// First time loading or any of the events are sent by this user: make sure to scroll the Roomtimeline
		// otherwise: subsequent scrolling will make the events visible
		let scrollToEventId = undefined;
		if (this.timelineEvents.length === 0) {
			// scroll to last event in timeline
			scrollToEventId = eventList[eventList.length - 1]?.matrixEvent.event.event_id ?? undefined;
		}
		if (eventList.some((x) => x.matrixEvent.event.sender?.trim() === this.user.userId?.trim())) {
			// scroll to first new event
			scrollToEventId = eventList[0]?.matrixEvent.event.event_id ?? undefined;
		}

		// First add the relatedEvents
		this.relatedEvents = this.relatedEvents.filter((x) => !eventList.some((newEvent) => newEvent.matrixEvent.event.event_id === x.matrixEvent.event?.content?.[RelationType.RelatesTo]?.event_id));
		this.getRelatedEvents(eventList).then((relatedEvents) => {
			this.relatedEvents = [...this.relatedEvents, ...relatedEvents];
		});
		// Then add the events to the timeline
		this.timelineEvents = this.timelineEvents.filter((x) => !eventList.some((newEvent) => newEvent.matrixEvent.event.event_id === x.matrixEvent.event.event_id));
		this.timelineEvents = [...this.timelineEvents, ...eventList];

		return scrollToEventId;
	}

	/**
	 * Checks if there is a redaction event of type Deleted or DeletedFromThread for a certain event
	 * @param eventId
	 * @returns True if it is deleted
	 */
	public IsDeletedEvent(eventId: string): boolean {
		const relatedEvent = this.redactedEvents.find(
			(x) =>
				x.matrixEvent.event.event_id === eventId &&
				x.matrixEvent.event.type === MatrixEventType.RoomRedaction &&
				(x.matrixEvent.event.content?.[Redaction.Reason] === Redaction.Deleted || x.matrixEvent.event.content?.[Redaction.Reason] === Redaction.DeletedFromThread),
		);
		return !!relatedEvent;
	}

	/**
	 * Set isDeleted true for all deleted events in this.timelineEvents
	 */
	private applyIsDeleted() {
		const eventMap = new Map(this.timelineEvents.map((event) => [event.matrixEvent.event.event_id, event]));
		this.redactedEvents.forEach((redacted) => {
			if (redacted.matrixEvent.event.event_id && this.IsDeletedEvent(redacted.matrixEvent.event.event_id)) {
				// if there is an event that gets redacted by this redacted event: set isDeleted
				const event = eventMap.get(redacted.matrixEvent.event.content?.[Redaction.Redacts]);
				if (event) {
					event.isDeleted = true;
				}
			}
		});
	}

	/**
	 * Loads timeline from the subscribed rooms in sliding sync
	 * @param matrixEvent[] events from sliding sync RoomData
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	async loadFromSlidingSync(matrixEvents: MatrixEvent[]): Promise<string | undefined> {
		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Loading events from sliding sync`);
		if (!matrixEvents || matrixEvents.length === 0) return undefined;

		this.relatedEvents = matrixEvents.filter((event) => event.getContent()[RelationType.RelatesTo]).map((event) => new TimelineEvent(event, this.roomId));

		// Filter out redacted events: not for timeline and not read in the related events because they are used only temporary (until the redacted_because field is set in the db)
		const redactedEvents = matrixEvents.filter((x) => x.getType() === MatrixEventType.RoomRedaction);
		this.redactedEvents = [...this.redactedEvents, ...redactedEvents.map((x) => new TimelineEvent(x, this.roomId))];
		this.applyIsDeleted();

		// TODO remove redacted events when necessary: so whenever a pagination is taking place

		// Filters out the visible events, so from now on we are working on the visible timeline
		matrixEvents = this.prepareEvents(matrixEvents);

		if (matrixEvents.length === 0) return undefined;
		let eventList = matrixEvents.map((event) => new TimelineEvent(event, this.roomId));

		// if the lastMessageId is undefined
		// or this events contains the lastMessageId
		// or one of the events is of the own user,
		// than we can add the new events
		if (
			this.paginationState.lastMessageId === undefined ||
			this.timelineEvents.some((x) => x.matrixEvent.event.event_id === this.paginationState.lastMessageId) ||
			eventList.some((x) => x.matrixEvent.event.sender === this.user.userId)
		) {
			this.paginationState.lastMessageId = eventList[eventList.length - 1]?.matrixEvent.event.event_id;
			if (this.timelineEvents.length === 0) {
				await this.loadToEvent({ eventId: eventList[eventList.length - 1].matrixEvent.event.event_id! });
				return eventList[eventList.length - 1]?.matrixEvent.event.event_id;
			} else {
				return this.addEventList(eventList);
			}
		}
		return undefined;
	}

	getEvents(): TimelineEvent[] {
		return this.timelineEvents;
	}

	getTimeLineRelatedEvents(): TimelineEvent[] {
		//return this.relatedEvents.filter((event) => event.matrixEvent.event.type === PubHubsMgType.VotingWidgetReply ||  PubHubsMgType.VotingWidgetClose || PubHubsMgType.VotingWidgetModify);
		//return this.relatedEvents.filter((event) => event.matrixEvent.event.type === PubHubsMgType.VotingWidgetReply ||   event.matrixEvent.event.type === PubHubsMgType.VotingWidgetClose ||  event.matrixEvent.event.type === PubHubsMgType.VotingWidgetModify ||  event.matrixEvent.event.type === PubHubsMgType.VotingWidgetPickOption );

		return this.relatedEvents.filter((event) => this.relatedEventTypes.has(event.matrixEvent.event.type));
	}

	/**
	 * Gets the eventtimeline of a certain event
	 * @param eventId
	 * @returns
	 */
	private async getEventTimeline(eventId: string): Promise<EventTimeline | null> {
		const room = this.client?.getRoom(this.roomId ?? undefined);
		if (!room) {
			return null;
		}
		// make sure the timeline is refreshed, so no gaps occur when eventId is in the history
		room.refreshLiveTimeline();

		const filter = new Filter(undefined, this.FILTER_ID);
		filter.setDefinition(this.timelineSetFilter);
		const timelineSet = room.getOrCreateFilteredTimelineSet(filter);

		return (await this.client.getEventTimeline(timelineSet, eventId)) ?? null;
	}

	/**
	 * Is it possible to paginate in given direction from this event?
	 * @param backwards
	 * @returns
	 */
	CanPaginate(eventId: string | undefined, backwards = true): boolean {
		if (!eventId) {
			return false;
		}
		return backwards ? this.paginationState.firstMessageId === eventId : this.paginationState.lastMessageId === eventId;
	}

	/**
	 * Paginate from event in given direction for a {limit} number of events
	 * @param timeline
	 * @param limit
	 * @param backwards
	 * @returns
	 */
	async performPaginate(direction: Direction, limit: number, timeline: EventTimeline): Promise<MatrixEvent[]> {
		let newEvents: MatrixEvent[] = [];
		if (
			await this.client.paginateEventTimeline(timeline, {
				backwards: direction === Direction.Backward,
				limit,
			})
		) {
			newEvents = timeline.getEvents();
		} else {
			newEvents = timeline.getEvents();
			// Here we have reached the first or last of all messages
			const firstMessageId = newEvents.length > 0 ? newEvents[0]?.event?.event_id : this.timelineEvents[0]?.matrixEvent.event?.event_id;
			const lastMessageId = newEvents.length > 0 ? newEvents[newEvents.length - 1]?.event?.event_id : this.timelineEvents[this.timelineEvents.length - 1]?.matrixEvent.event?.event_id;
			direction === Direction.Backward ? (this.paginationState.firstMessageId = firstMessageId) : (this.paginationState.lastMessageId = lastMessageId);
		}
		return this.prepareEvents(newEvents);
	}

	/**
	 * returns a list of newEvents that is filled to a limit of events taken from the events array
	 * @param events - current events in list
	 * @param newEvents - fetched new events
	 * @param limit - total number of evetns needed
	 * @param direction - Direction.Forward or Direction.Backward
	 * @returns
	 */
	ensureListLength(events: TimelineEvent[], newEvents: TimelineEvent[], limit: number, direction: Direction): TimelineEvent[] {
		const newIds = new Set(newEvents.map((e) => e.matrixEvent.event.event_id));
		// Find index of first overlapping event in `events`
		const overlapIndex = events.findIndex((e) => newIds.has(e.matrixEvent.event.event_id));
		if (overlapIndex === -1) {
			// No overlap — fallback to slicing from start or end
			const filler = direction === Direction.Backward ? events.slice(-Math.max(0, limit - newEvents.length)) : events.slice(0, Math.max(0, limit - newEvents.length));
			return [...newEvents, ...filler];
		}

		// Filter out duplicates
		const filteredEvents = events.filter((e) => !newIds.has(e.matrixEvent.event.event_id));

		// Select filler based on direction
		let filler: TimelineEvent[] = [];
		if (direction === Direction.Backward) {
			//if overlapIndex is null, then fill from the back
			if (overlapIndex > 0) {
				filler = filteredEvents.slice(0, overlapIndex).slice(-Math.max(0, limit - newEvents.length));
			} else {
				const reversedIndex = [...events].reverse().findIndex((e) => newIds.has(e.matrixEvent.event.event_id));
				const lastOverlapIndex = reversedIndex === -1 ? -1 : events.length - 1 - reversedIndex;
				filler = filteredEvents.slice(lastOverlapIndex + 1).slice(0, Math.max(0, limit - newEvents.length));
			}
		} else {
			filler = filteredEvents.slice(overlapIndex + 1).slice(0, Math.max(0, limit - newEvents.length));
		}
		return [...newEvents, ...filler];
	}

	/**
	 * Paginate the timeline in given direction for a number of events, starting from a certain event
	 * @param direction
	 * @param limit
	 * @param fromEventId
	 */
	async paginate(direction: Direction, limit: number, fromEventId: string) {
		const timeline = await this.getEventTimeline(fromEventId);
		if (!timeline) {
			this.timelineEvents = [];
		} else {
			const newEvents = await this.performPaginate(direction, limit, timeline);
			if (newEvents?.length > 0) {
				let timeLineEvents = newEvents.map((event) => new TimelineEvent(event, this.roomId));
				timeLineEvents = this.ensureListLength(this.timelineEvents, timeLineEvents, SystemDefaults.RoomTimelineLimit, direction);

				this.getRelatedEvents(timeLineEvents);
				this.timelineEvents = this.timelineEvents.filter((x) => !timeLineEvents.some((newEvent) => newEvent.matrixEvent.event.event_id === x.matrixEvent.event.event_id));
				if (direction == Direction.Backward) {
					this.timelineEvents = [...timeLineEvents, ...this.timelineEvents];
				} else {
					this.timelineEvents = [...this.timelineEvents, ...timeLineEvents];
				}
			}
		}
	}

	/**
	 * Loads the timeline to a certain event, paginating in both directions if needed
	 * @param currentEvent event to load the timeline to
	 * @returns
	 */
	public async loadToEvent(currentEvent: TCurrentEvent) {
		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Loading timeline to event ${currentEvent.eventId}`);
		// in case the event is not currently in the list: try to get it from its timeline
		const timeline = await this.getEventTimeline(currentEvent.eventId);
		if (!timeline) {
			return [];
		}
		let tempEvents: MatrixEvent[] = this.prepareEvents(timeline.getEvents());

		// need to paginate both directions, for when event is in beginning or end. The surplus does not matter
		const joinPromises: Promise<any>[] = [];
		joinPromises.push(this.performPaginate(Direction.Backward, SystemDefaults.RoomTimelineLimit, timeline));
		joinPromises.push(this.performPaginate(Direction.Forward, SystemDefaults.RoomTimelineLimit, timeline));

		Promise.all(joinPromises).then(([newBackEvents, newForwardEvents]) => {
			if (newBackEvents?.length > 0 || newForwardEvents?.length > 0) {
				tempEvents = [...newBackEvents, ...newForwardEvents];
				tempEvents = Array.from(new Map(tempEvents.map((e) => [e.event.event_id, e])).values()); // make unique
			}
			let mappedEvents = tempEvents.map((event) => new TimelineEvent(event, this.roomId));
			mappedEvents = this.ensureListLength(this.timelineEvents, mappedEvents, SystemDefaults.RoomTimelineLimit, Direction.Backward);

			this.getRelatedEvents(mappedEvents).then((relatedEvents) => {
				this.relatedEvents = relatedEvents;
			});

			this.timelineEvents = mappedEvents;
			this.redactedEvents = []; // Loaded to new event so we can remove the redactedevents
		});
	}

	/**
	 * Is the oldest message in the room loaded in the timeline?
	 * @returns
	 */
	public isOldestMessageLoaded(): boolean {
		return this.paginationState.firstMessageId === undefined ? false : this.timelineEvents.some((x) => x.matrixEvent.event.event_id === this.paginationState.firstMessageId);
	}

	/**
	 * Is the newest message in the room loaded in the timeline?
	 * @returns
	 */
	public isNewestMessageLoaded(): boolean {
		return this.paginationState.lastMessageId === undefined ? false : this.timelineEvents.some((x) => x.matrixEvent.event.event_id === this.paginationState.lastMessageId);
	}

	/**
	 * @returns Id of the oldest message in the room, undefined if not known
	 */
	public getRoomOldestMessageId(): string | undefined {
		return this.paginationState.firstMessageId;
	}

	/**
	 * @returns Id of the newest message in the room, undefined if not known
	 */
	public getRoomNewestMessageId(): string | undefined {
		return this.paginationState.lastMessageId;
	}

	/**
	 *
	 * @returns Id of the oldest message currently loaded in the timeline, undefined if no messages loaded
	 */
	public getTimelineOldestMessageId(): string | undefined {
		return this.timelineEvents[0]?.matrixEvent.event?.event_id;
	}

	/**
	 *
	 * @returns Id of the newest message currently loaded in the timeline, undefined if no messages loaded
	 */
	public getTimelineNewestMessageId(): string | undefined {
		return this.timelineEvents[this.timelineEvents.length - 1]?.matrixEvent.event?.event_id;
	}

	/**
	 * Tries to find an event in the timeline by its Id
	 * @param eventId eventId to find
	 * @returns
	 */
	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `find by eventId ${eventId}...`, { eventId });
		return this.timelineEvents?.find((x) => x.matrixEvent.event.event_id === eventId)?.matrixEvent;
	}

	/**
	 * Get the list of redacted event IDs in the timeline
	 * @returns List of Ids of redacted events in the timeline
	 */

	public getRedactedEventIds() {
		return this.redactedEventIds;
	}
}

export { TimelineManager };
