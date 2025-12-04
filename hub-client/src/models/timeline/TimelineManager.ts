// Packages
import { Direction, EventTimeline, EventType, Filter, MatrixClient, MatrixEvent, MsgType } from 'matrix-js-sdk';

// Stores
import { useMatrix } from '@hub-client/composables/matrix.composable';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

// Models
import { MatrixEventType, Redaction, RelatedEventsOptions, RelationType, SystemDefaults } from '@hub-client/models/constants';
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

type TRelatedEvents = {
	eventId: string;
	isFetched: boolean;
	relatedEvents: MatrixEvent[];
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
	/** Contains all redacted events, deletions and edits */
	private redactedEvents: TimelineEvent[] = [];
	/** Contains all roomlibrary events */
	private libraryEvents: TimelineEvent[] = [];
	/** Contains all related events: reactions, annotations etc. */
	private relatedEvents: TRelatedEvents[] = [];

	private roomId: string;

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
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
				types: [EventType.RoomMessage, EventType.RoomRedaction, PubHubsMgType.LibraryFileMessage, PubHubsMgType.SignedFileMessage],
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
	public initRoomTimeline(roomId: string) {
		const matrix = useMatrix();

		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Initializing timeline for room ${roomId}`);
		this.roomId = roomId;

		this.roomTimelineKey = matrix.addRoomSubscription(roomId);
	}

	/**
	 * Prepares the events for use in the room timeline: filters isVisible and sorts
	 * @param eventList eventlist coming from Sliding sync, to be prepared for use
	 * @returns eventList to use in the RoomTimeline
	 */
	private prepareEvents(eventList: MatrixEvent[]): MatrixEvent[] {
		return eventList.filter((event) => this.isVisibleEvent(event.event)).sort((a, b) => a.getTs() - b.getTs());
	}

	// Add events to the relatedEvents
	// only when the event is not in there already
	// The array of relatedEvents is sorted on timestamp (oldest -> newest)
	private addRelatedEvents(events: MatrixEvent[]) {
		if (events.length <= 0) return;
		events.forEach((eventToAdd) => {
			const relatesToEvent = eventToAdd.event.content?.[RelationType.RelatesTo]?.event_id;
			const relatedEventsEntry = this.relatedEvents.find((x) => x.eventId === relatesToEvent);
			if (relatedEventsEntry) {
				if (!relatedEventsEntry.relatedEvents.find((y) => y.event.event_id === eventToAdd.event.event_id)) {
					relatedEventsEntry.relatedEvents.push(eventToAdd);
					relatedEventsEntry.relatedEvents.sort((a, b) => a.getTs() - b.getTs());
				}
			} else {
				this.relatedEvents.push({ eventId: relatesToEvent!, isFetched: false, relatedEvents: [eventToAdd] });
			}
		});
	}

	// Fetches the relations of an event. First check if it has not been done yet.
	// If it has not been done: perform the API call and add or replace all relations in the relatedEvents
	public fetchRelatedEvents(eventIds: string[]) {
		eventIds.forEach((eventId) => {
			// find current relations
			const currentrelatedEvents = this.relatedEvents.find((x) => x.eventId === eventId);

			// if found and already fetched from server: do nothing
			if (currentrelatedEvents && currentrelatedEvents.isFetched) {
				return;
			}

			this.client.relations(this.roomId, eventId, null, null).then((relations) => {
				// add or replace relations and set isFetched to true, so the API call will be once per event
				if (currentrelatedEvents) {
					currentrelatedEvents.isFetched = true;
					for (const relation of relations.events) {
						const i = currentrelatedEvents.relatedEvents.findIndex((x) => x.event.event_id === relation.event.event_id);
						if (i >= 0) {
							currentrelatedEvents.relatedEvents[i] = relation;
						} else {
							currentrelatedEvents.relatedEvents.push(relation);
						}
					}
				} else {
					this.relatedEvents.push({ eventId: eventId, isFetched: true, relatedEvents: relations.events });
				}
			});
		});
	}

	public getRelatedEvents(eventId: string): TimelineEvent[] {
		return this.relatedEvents.find((x) => x.eventId === eventId)?.relatedEvents.map((x) => new TimelineEvent(x, this.roomId)) ?? [];
	}

	// Gets related events, either all (defined in this.relatedEventTypes) or of one specific type and or contenttype (for instance EvenType.Reaction, RelationType.Annotation)
	public getRelatedEventsByType(eventId: string, options: RelatedEventsOptions = {}): TimelineEvent[] {
		const relatedEvents = this.getRelatedEvents(eventId);
		if (!relatedEvents) {
			return [];
		}
		const byEventType = options.eventType ? relatedEvents.filter((event) => event.matrixEvent.event.type === options.eventType) : relatedEvents.filter((event) => this.relatedEventTypes.has(event.matrixEvent.event.type!));
		const byContentType = options.contentRelType ? byEventType.filter((event) => event.matrixEvent.getContent()?.[RelationType.RelatesTo]?.rel_type === options.contentRelType) : byEventType;
		return byContentType.filter((x) => !x.isDeleted);
	}

	/**
	 * actual adding of events to the timeline
	 * used for adding events arriving with sliding sync when there is already a roomtimeline
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

		// Then add the events to the timeline
		this.timelineEvents = this.timelineEvents.filter((x) => !eventList.some((newEvent) => newEvent.matrixEvent.event.event_id === x.matrixEvent.event.event_id));
		this.timelineEvents = [...this.timelineEvents, ...eventList];

		return scrollToEventId;
	}

	/**
	 * Loads the timeline to a certain event, paginating in both directions if needed
	 * used for adding the first events, when there is no roomtimeline yet
	 * @param currentEvent event to load the timeline to
	 * @returns
	 */
	public async loadToEvent(currentEvent: TCurrentEvent): Promise<TimelineEvent[]> {
		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Loading timeline to event ${currentEvent.eventId}`);
		// in case the event is not currently in the list: try to get it from its timeline
		const timeline = await this.getEventTimeline(currentEvent.eventId);
		if (!timeline) {
			return [];
		}

		let tempEvents: MatrixEvent[] = this.prepareEvents(timeline.getEvents());

		// need to paginate both directions, for when event is in beginning or end. The surplus does not matter
		const joinPromises: Promise<MatrixEvent[]>[] = [];
		joinPromises.push(this.performPaginate(Direction.Backward, SystemDefaults.initialRoomTimelineLimit, timeline));
		joinPromises.push(this.performPaginate(Direction.Forward, SystemDefaults.initialRoomTimelineLimit, timeline));

		const [newBackEvents, newForwardEvents] = await Promise.all(joinPromises);

		if (newBackEvents?.length > 0 || newForwardEvents?.length > 0) {
			tempEvents = [...newBackEvents, ...newForwardEvents];
			tempEvents = Array.from(new Map(tempEvents.map((e) => [e.event.event_id, e])).values()); // make unique
		}

		let mappedEvents = tempEvents.map((event) => new TimelineEvent(event, this.roomId));
		mappedEvents = this.ensureListLength(this.timelineEvents, mappedEvents, SystemDefaults.roomTimelineLimit, Direction.Backward);

		this.timelineEvents = mappedEvents;

		return mappedEvents;
	}

	/**
	 * Loads timeline from the subscribed rooms in sliding sync
	 * @param matrixEvent[] events from sliding sync RoomData
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	async loadFromSlidingSync(matrixEvents: MatrixEvent[]): Promise<string | undefined> {
		LOGGER.log(SMI.ROOM_TIMELINEMANAGER, `Loading events from sliding sync`);
		if (!matrixEvents || matrixEvents.length === 0) return undefined;

		// Related Events
		const relatedEvents = matrixEvents.filter((event) => event.getContent()[RelationType.RelatesTo]);
		this.addRelatedEvents(relatedEvents);

		// Redacted Events
		const redactedEvents = matrixEvents.filter((event) => event.getType() === EventType.RoomRedaction);
		this.redactedEvents = [...this.redactedEvents, ...redactedEvents.map((x) => new TimelineEvent(x, this.roomId))];

		// TODO this is now necessary for reactions that use RedactedEventIds, in the future refactor to use standard redactions
		// if the redacted event concerns a deleted reaction, put the id in the redactedEventIds
		this.redactedEvents.forEach((redacted) => {
			if (redacted.matrixEvent.event.type === MatrixEventType.RoomRedaction && redacted.matrixEvent.event.content?.[Redaction.Reason] === Redaction.Deleted) {
				const deletedEvent = redacted.matrixEvent.event.content?.[Redaction.Redacts];
				if (!this.redactedEventIds.some((x) => x === deletedEvent)) {
					this.redactedEventIds.push(deletedEvent);
				}
			}
		});

		// Filters out the Library events
		const libraryEvents = matrixEvents.filter(
			(x) => (x.getType() === PubHubsMgType.LibraryFileMessage || x.getType() === PubHubsMgType.SignedFileMessage) && x.getType() !== Redaction.DeletedFromLibrary && x.getType() !== Redaction.Redacts,
		);
		this.libraryEvents = [...this.libraryEvents, ...libraryEvents.map((x) => new TimelineEvent(x, this.roomId))];
		// Filter out double, sometimes after sync items get doubled
		this.libraryEvents = this.libraryEvents.filter((item, index, self) => self.findIndex((innerItem) => innerItem.matrixEvent.getId() === item.matrixEvent.getId()) === index);

		this.applyIsDeleted([...this.timelineEvents, ...this.libraryEvents]);

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

	/**
	 * Checks if there is a redaction event of type Deleted or DeletedFromThread for a certain event
	 * @param eventId
	 * @returns True if it is deleted
	 */
	public IsDeletedEvent(eventId: string): boolean {
		if (this.redactedEvents.length <= 0) return false;
		const redactedEvent = this.redactedEvents.find(
			(x) =>
				x.matrixEvent.event.content?.[Redaction.Redacts] === eventId &&
				x.matrixEvent.event.type === MatrixEventType.RoomRedaction &&
				(x.matrixEvent.event.content?.[Redaction.Reason] === Redaction.Deleted ||
					x.matrixEvent.event.content?.[Redaction.Reason] === Redaction.DeletedFromThread ||
					x.matrixEvent.event.content?.[Redaction.Reason] === Redaction.DeletedFromLibrary),
		);
		return !!redactedEvent;
	}

	/**
	 * Set isDeleted true for all deleted events in this.timelineEvents
	 */
	private applyIsDeleted(events: TimelineEvent[]) {
		events.forEach((x) => {
			x.isDeleted = this.IsDeletedEvent(x.matrixEvent.event.event_id!);
		});
	}

	public getEvents(): TimelineEvent[] {
		return this.timelineEvents;
	}

	public getLibraryEvents(): TimelineEvent[] {
		return this.libraryEvents;
	}

	/**
	 * Gets the eventtimeline of a certain event
	 * @param eventId
	 * @returns
	 */
	private async getEventTimeline(eventId: string): Promise<EventTimeline | null> {
		const room = this.client?.getRoom(this.roomId ?? undefined);
		if (!room || !eventId || eventId === '') {
			return null;
		}

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
	private CanPaginate(eventId: string | undefined, backwards = true): boolean {
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
	private async performPaginate(direction: Direction, limit: number, timeline: EventTimeline): Promise<MatrixEvent[]> {
		let newEvents: MatrixEvent[] = [];
		try {
			// Since paginateEventTimeline paginates the unfiltered timeline and filtering takes place in the sdk,
			// there is a chance that one paginate does not fetch all needed messages.
			// It requests 'limit' events, but returns the filtered ones. That is why we need a loop
			// PaginateEventTimeline is not consistent in its returnvalue: it is a boolean that iondicates whether further pagination is possible,
			// but sometimes the history of the room is incorrect read and it keeps returning true. In that case we try only 2 times.
			let canPaginate = true;
			let numberoftries = 0;
			while (numberoftries < 2 && canPaginate && timeline.getEvents().length < limit) {
				const before = timeline.getEvents().length;
				canPaginate = await this.client.paginateEventTimeline(timeline, {
					backwards: direction === Direction.Backward,
					limit,
				});
				// canpaginate is true, but no new events: try just a couple of times to prevent hanging loop
				if (canPaginate && before === timeline.getEvents().length) {
					numberoftries++;
				}
			}
			newEvents = timeline.getEvents();
			if (!canPaginate) {
				// Here we have reached the first or last of all messages
				const firstMessageId = newEvents.length > 0 ? newEvents[0]?.event?.event_id : this.timelineEvents[0]?.matrixEvent.event?.event_id;
				const lastMessageId = newEvents.length > 0 ? newEvents[newEvents.length - 1]?.event?.event_id : this.timelineEvents[this.timelineEvents.length - 1]?.matrixEvent.event?.event_id;
				direction === Direction.Backward ? (this.paginationState.firstMessageId = firstMessageId) : (this.paginationState.lastMessageId = lastMessageId);
			}
		} catch {
			// ignore error: used for an empty timeline
		}
		return this.prepareEvents(newEvents);
	}

	/**
	 * returns a list of newEvents that is filled to a limit of events taken from the events array
	 * @param events - current events in list
	 * @param newEvents - fetched new events
	 * @param limit - total number of events needed
	 * @param direction - Direction.Forward or Direction.Backward
	 * @returns
	 */
	private ensureListLength(events: TimelineEvent[], newEvents: TimelineEvent[], limit: number, direction: Direction): TimelineEvent[] {
		const newIds = new Set(newEvents.map((e) => e.matrixEvent.event.event_id));
		// Find index of first overlapping event in `events`
		const overlapIndex = events.findIndex((e) => newIds.has(e.matrixEvent.event.event_id));
		if (overlapIndex === -1) {
			// No overlap — fallback to slicing from start or end
			const currentEvents = direction === Direction.Backward ? events.slice(-Math.max(0, limit - newEvents.length)) : events.slice(0, Math.max(0, limit - newEvents.length));
			if (direction === Direction.Backward) {
				return [...newEvents, ...currentEvents];
			} else {
				return [...currentEvents, ...newEvents];
			}
		}

		// Filter out duplicates
		const filteredEvents = events.filter((e) => !newIds.has(e.matrixEvent.event.event_id));

		// Select filler based on direction
		let currentEvents: TimelineEvent[] = [];
		if (direction === Direction.Backward) {
			//if overlapIndex is null, then fill from the back
			if (overlapIndex > 0) {
				currentEvents = filteredEvents.slice(0, overlapIndex).slice(-Math.max(0, limit - newEvents.length));
			} else {
				currentEvents = filteredEvents.slice(0, overlapIndex).slice(-Math.max(0, limit - newEvents.length));
				const reversedIndex = [...events].reverse().findIndex((e) => newIds.has(e.matrixEvent.event.event_id));
				const lastOverlapIndex = reversedIndex === -1 ? -1 : events.length - 1 - reversedIndex;
				currentEvents = filteredEvents.slice(lastOverlapIndex + 1).slice(0, Math.max(0, limit - newEvents.length));
			}
		} else {
			currentEvents = filteredEvents.slice(overlapIndex + 1).slice(0, Math.max(0, limit - newEvents.length));
		}
		return [...currentEvents, ...newEvents];
	}

	/**
	 * Paginate the timeline in given direction for a number of events, starting from a certain event
	 * @param direction
	 * @param limit
	 * @param fromEventId
	 */
	public async paginate(direction: Direction, limit: number, fromEventId: string) {
		const timeline = await this.getEventTimeline(fromEventId);
		if (!timeline) {
			this.timelineEvents = [];
		} else {
			const newEvents = await this.performPaginate(direction, limit, timeline);
			if (newEvents?.length > 0) {
				let timeLineEvents = newEvents.map((event) => new TimelineEvent(event, this.roomId));
				timeLineEvents = this.ensureListLength(this.timelineEvents, timeLineEvents, SystemDefaults.roomTimelineLimit, direction);
				timeLineEvents = timeLineEvents.filter((x) => !this.timelineEvents.some((newEvent) => newEvent.matrixEvent.event.event_id === x.matrixEvent.event.event_id));
				timeLineEvents.forEach((x) => {
					//this.reactionsTracker.addEvent(x.matrixEvent);
					//this.editsTracker.addEvent(x.matrixEvent);
				});
				if (direction === Direction.Backward) {
					this.timelineEvents = [...timeLineEvents, ...this.timelineEvents];
				} else {
					this.timelineEvents = [...this.timelineEvents, ...timeLineEvents];
				}
			}
		}
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

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
	public getRedactedEventIds() {
		return this.redactedEventIds;
	}
}

export { TimelineManager };
