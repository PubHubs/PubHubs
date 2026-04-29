// Packages
import { type THideMessageContent } from '../events/TMessageEvent';
import { Direction, EventTimeline, EventType, Filter, type IRoomEvent, type MatrixClient, type MatrixEvent, MsgType } from 'matrix-js-sdk';

// Stores
import { useMatrix } from '@hub-client/composables/matrix.composable';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { MatrixEventType, Redaction, type RelatedEventsOptions, RelationType, SystemDefaults } from '@hub-client/models/constants';
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { type TCurrentEvent } from '@hub-client/models/events/types';

// Stores
import { useUser } from '@hub-client/stores/user';

const logger = createLogger('TimelineManager');

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

type TimelineFilter = {
	room: {
		timeline: {
			types: string[];
		};
	};
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
	/** Increasing version counter, bumped on every timeline mutation */
	private _timelineVersion: number = 0;
	/** Contains all redacted events, deletions and edits */
	private redactedEvents: TimelineEvent[] = [];
	/** Contains all roomlibrary events */
	private libraryEvents: TimelineEvent[] = [];
	/** Contains all related events: reactions, annotations etc. */
	private relatedEvents: TRelatedEvents[] = [];
	// Cotains related hide events
	private hideMessageEvents: MatrixEvent[] = [];

	private roomId: string;

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
	private redactedEventIds: string[] = [];

	/** roomTimelineKey of the sliding sync subscription of this timelinemanager */
	private roomTimelineKey: string | undefined;

	// Added Room Member to get the avatar value when change happen
	private visibleEventTypes: string[] = [EventType.RoomMessage];
	private invisibleMessageTypes: string[] = [MsgType.Notice];
	private invisibleRelatesToTypes: string[] = [RelationType.Thread];

	// Filter on timeline for messages
	private readonly timelineFilter: TimelineFilter = {
		room: {
			timeline: {
				types: [EventType.RoomMessage, EventType.RoomRedaction, PubHubsMgType.HideMessage],
			},
		},
	};
	private readonly MessageFilter: Filter = new Filter(undefined, 'MessageFilter');

	// Filter on timeline for LibraryEvents
	private readonly fileLibraryFilter: TimelineFilter = {
		room: {
			timeline: {
				types: [PubHubsMgType.LibraryFileMessage, PubHubsMgType.SignedFileMessage],
			},
		},
	};
	private readonly LibraryFilter: Filter = new Filter(undefined, 'LibraryFilter');

	private readonly relatedEventTypes = new Set([
		PubHubsMgType.VotingWidgetReply,
		PubHubsMgType.VotingWidgetClose,
		PubHubsMgType.VotingWidgetModify,
		PubHubsMgType.VotingWidgetPickOption,
		EventType.Reaction,
		PubHubsMgType.HideMessage,
	]);

	constructor(roomId: string, client: MatrixClient) {
		this.roomId = roomId;
		this.client = client;
		this.MessageFilter.setDefinition(this.timelineFilter);
		this.LibraryFilter.setDefinition(this.fileLibraryFilter);
	}

	/**
	 *
	 * @returns the default filter that is used for retrieving messages from the timeline
	 */
	public getMessagesFilter(): Filter {
		return this.MessageFilter;
	}

	/**
	 * Check if an event should be visible in the timeline
	 * @param event event to check
	 * @returns true if the event should be visible, false otherwise
	 */
	public isVisibleEvent(event: MatrixEvent): boolean {
		if (event.getType() && !this.visibleEventTypes.includes(event.getType())) {
			return false;
		}
		if (event.getContent().msgtype) {
			if (this.invisibleMessageTypes.includes(event.getContent().msgtype as string)) {
				return false;
			}
		}
		if (this.invisibleRelatesToTypes.includes(event.getContent()?.[RelationType.RelatesTo]?.rel_type as string)) {
			return false;
		}
		if (event.getContent().msgtype === PubHubsMgType.WhisperMessage) {
			const currentUserId = this.user.userId;
			const whisperToUserId = event.getContent().whisper_to;
			const senderId = event.getSender();
			// Whisper is private to sender and target user only.
			if (!currentUserId || (senderId !== currentUserId && whisperToUserId !== currentUserId)) {
				return false;
			}
		}
		if (event.getContent().msgtype === PubHubsMgType.HideMessage) {
			this.hideMessageEvents.push(event);
			return false;
		}
		// Deleted events from threads may not be visible; they have lost the direct connection to their thread
		if (event.getUnsigned().redacted_because?.redacts) {
			if (event.getUnsigned().redacted_because?.content.reason === Redaction.DeletedFromThread) {
				return false;
			}
		}
		return true;
	}

	/**
	 * Returns whether a moderator has hidden this event,
	 * and shows the label if it is defined.
	 */
	public getHideState(eventId: string): { isHidden: boolean; label?: string } {
		const isHideOrUnhideEvent = (content: THideMessageContent) =>
			(content?.[RelationType.RelatesTo]?.rel_type === RelationType.Hide || content?.[RelationType.RelatesTo]?.rel_type === RelationType.UnHide) &&
			content?.[RelationType.RelatesTo]?.event_id === eventId;

		// Find the most recent matching event from timeline
		const latestTimelineEvent = this.hideMessageEvents
			.filter((event) => isHideOrUnhideEvent(event.getContent()))
			.reduce<
				(typeof this.hideMessageEvents)[0] | undefined
			>((latest, event) => (!latest || (event.getTs() ?? 0) > (latest.getTs() ?? 0) ? event : latest), undefined);

		// Find the most recent matching event from related events
		const latestRelatedEvent = this.getRelatedEvents(eventId)
			.filter((event) => isHideOrUnhideEvent(event.matrixEvent.getContent()))
			.reduce<ReturnType<typeof this.getRelatedEvents>[0] | undefined>(
				(latest, event) => (!latest || (event.matrixEvent.getTs() ?? 0) > (latest?.matrixEvent.getTs() ?? 0) ? event : latest),
				undefined,
			);

		// Compare the two to get the absolute latest
		const latestHideMessage =
			(latestRelatedEvent?.matrixEvent.getTs() ?? 0) > (latestTimelineEvent?.getTs() ?? 0) ? latestRelatedEvent?.matrixEvent : latestTimelineEvent;

		return {
			isHidden: latestHideMessage?.getContent()?.[RelationType.RelatesTo]?.rel_type === RelationType.Hide,
			label: latestHideMessage?.getContent()?.ph_hidden_label as string,
		};
	}

	/**
	 * Initializes the timeline for a room: subscribes to the room in sliding sync and starts syncing
	 * @param roomId Id of the room to initialize the timeline for
	 */
	public initRoomTimeline(roomId: string) {
		const matrix = useMatrix();

		logger.info(`Initializing timeline for room ${roomId}`);

		this.roomId = roomId;
		this.roomTimelineKey = matrix.addRoomSubscription(roomId);
	}

	/**
	 * Initalizes the file library timeline: fetch all files
	 * @returns
	 */
	async initFileLibrary() {
		const messageResponse = await this.client.createMessagesRequest(
			this.roomId,
			null,
			SystemDefaults.maxLibraryFiles,
			Direction.Backward,
			this.LibraryFilter,
		);
		const eventMapper = this.client.getEventMapper();
		const newEvents = messageResponse.chunk.map((x: IRoomEvent) => eventMapper(x));
		const newTimelineEvents = newEvents.map((event) => new TimelineEvent({ matrixEvent: event, roomId: this.roomId }));

		// This is called on opening the filelibrary. Then there may already have been some files added through the sliding sync.
		// So we need to add these files to the existing, with filtering out the duplicates (by eventId)
		this.fileLibraryAddEvents(newTimelineEvents);
	}

	fileLibraryAddEvents(newEvents: TimelineEvent[]) {
		const existingEventIds = new Set(this.libraryEvents.map((x) => x.matrixEvent.event.event_id));
		newEvents.forEach((event) => {
			if (!existingEventIds.has(event.matrixEvent.event.event_id)) {
				this.libraryEvents.push(event);
				existingEventIds.add(event.matrixEvent.event.event_id);
			}
		});
	}

	/**
	 * Prepares the events for use in the room timeline: filters isVisible and sorts
	 * @param eventList eventlist coming from Sliding sync, to be prepared for use
	 * @returns eventList to use in the RoomTimeline
	 */
	private prepareEvents(eventList: MatrixEvent[]): MatrixEvent[] {
		return eventList.filter((event) => this.isVisibleEvent(event)).sort((a, b) => a.getTs() - b.getTs());
	}

	// Add events to the relatedEvents
	// only when the event is not in there already
	// The array of relatedEvents is sorted on timestamp (oldest -> newest)
	private async addRelatedEvents(events: MatrixEvent[]) {
		if (events.length <= 0) return;

		for (const eventToAdd of events) {
			if (eventToAdd.getContent()?.[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread) {
				// Fetch thread for newly created threads that are not the currentthread and ar not yet recognized as thread in this client
				const rootId = eventToAdd.getContent()?.[RelationType.RelatesTo]?.event_id;
				const rootEvent = this.timelineEvents.find((x) => rootId === x.matrixEvent.getId());
				if (rootEvent) {
					const room = this.client?.getRoom(this.roomId);
					if (room) {
						const alreadyExists = room.findEventById(eventToAdd.getId() ?? '');
						const alreadyInThread = rootEvent.isEventInThread(eventToAdd.getId() ?? '');
						if (!alreadyExists && !alreadyInThread) {
							await room.addLiveEvents([eventToAdd], { addToState: false });
							rootEvent.loadThread();
						}
					}
				}
			} else {
				// Handle all other related events
				const relatesToEvent = eventToAdd.getContent()?.[RelationType.RelatesTo]?.event_id;
				const relatedEventsEntry = this.relatedEvents.find((x) => x.eventId === relatesToEvent);
				if (relatedEventsEntry) {
					if (!relatedEventsEntry.relatedEvents.find((y) => y.getId() === eventToAdd.getId())) {
						relatedEventsEntry.relatedEvents.push(eventToAdd);
						relatedEventsEntry.relatedEvents.sort((a, b) => a.getTs() - b.getTs());
					}
				} else {
					if (relatesToEvent) {
						this.relatedEvents.push({ eventId: relatesToEvent, isFetched: false, relatedEvents: [eventToAdd] });
					}
				}
			}
		}
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

			// check if eventId is a valid event, to remove API errors from client.relations
			const room = this.client?.getRoom(this.roomId ?? undefined);
			if (!room?.findEventById(eventId)) {
				return;
			}

			this.client
				.relations(this.roomId, eventId, null, null)
				.then((relations) => {
					// add or replace relations and set isFetched to true, so the API call will be once per event
					if (currentrelatedEvents) {
						currentrelatedEvents.isFetched = true;
						for (const relation of relations.events) {
							const i = currentrelatedEvents.relatedEvents.findIndex((x) => x.getId() === relation.getId());
							if (i >= 0) {
								currentrelatedEvents.relatedEvents[i] = relation;
							} else {
								currentrelatedEvents.relatedEvents.push(relation);
							}
						}
					} else {
						this.relatedEvents.push({ eventId: eventId, isFetched: true, relatedEvents: relations.events });
					}
				})
				.catch(() => {
					// Intentionally empty: errors from fetching related events are suppressed
				});
		});
	}

	public getRelatedEvents(eventId: string): TimelineEvent[] {
		return (
			this.relatedEvents.find((x) => x.eventId === eventId)?.relatedEvents.map((x) => new TimelineEvent({ matrixEvent: x, roomId: this.roomId })) ?? []
		);
	}

	// Gets related events, either all (defined in this.relatedEventTypes) or of one specific type and or contenttype (for instance EvenType.Reaction, RelationType.Annotation)
	public getRelatedEventsByType(eventId: string, options: RelatedEventsOptions = {}): TimelineEvent[] {
		const relatedEvents = this.getRelatedEvents(eventId);
		if (!relatedEvents) {
			return [];
		}
		const byEventType = options.eventType
			? relatedEvents.filter((event) => event.matrixEvent.getType() === options.eventType)
			: relatedEvents.filter((event) => this.relatedEventTypes.has(event.matrixEvent.getType() as EventType | PubHubsMgType));
		const byContentType = options.contentRelType
			? byEventType.filter((event) => event.matrixEvent.getContent()?.[RelationType.RelatesTo]?.rel_type === options.contentRelType)
			: byEventType;
		return byContentType.filter((x) => !x.isDeleted);
	}

	/**
	 * actual adding of events to the timeline
	 * used for adding events arriving with sliding sync when there is already a roomtimeline
	 * @param eventList List of events to add
	 * @param threadrootIds List of threat rootIds coming from sliding sync
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	private async addEventList(eventList: TimelineEvent[]): Promise<string | undefined> {
		// First time loading or any of the events are sent by this user: make sure to scroll the Roomtimeline
		// otherwise: subsequent scrolling will make the events visible
		let scrollToEventId = undefined;
		if (this.timelineEvents.length === 0) {
			// scroll to last event in timeline
			scrollToEventId = eventList[eventList.length - 1]?.matrixEvent.getId() ?? undefined;
		}
		if (eventList.some((x) => x.matrixEvent.getSender()?.trim() === this.user.userId?.trim())) {
			// scroll to first new event
			scrollToEventId = eventList[0]?.matrixEvent.getId() ?? undefined;
		}

		// Then add the events to the timeline
		this.timelineEvents = this.timelineEvents.filter((x) => !eventList.some((newEvent) => newEvent.matrixEvent.getId() === x.matrixEvent.getId()));
		this.timelineEvents = [...this.timelineEvents, ...eventList];
		this._timelineVersion++;

		return scrollToEventId;
	}

	/**
	 * Loads the timeline to a certain event, paginating in both directions if needed
	 * used for adding the first events, when there is no roomtimeline yet
	 * @param currentEvent event to load the timeline to
	 * @returns
	 */
	public async loadToEvent(currentEvent: TCurrentEvent): Promise<TimelineEvent[]> {
		logger.info(`Loading timeline to event ${currentEvent.eventId}`);
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
			tempEvents = [...newBackEvents, ...tempEvents, ...newForwardEvents];
			tempEvents = Array.from(new Map(tempEvents.map((e) => [e.getId(), e])).values()); // make unique
		}

		let mappedEvents = tempEvents.map((event) => new TimelineEvent({ matrixEvent: event, roomId: this.roomId }));
		mappedEvents = this.ensureListLength(this.timelineEvents, mappedEvents, SystemDefaults.roomTimelineLimit, Direction.Backward);

		this.timelineEvents = mappedEvents;
		this._timelineVersion++;

		return mappedEvents;
	}

	/**
	 * Loads timeline from the subscribed rooms in sliding sync
	 * @param matrixEvent[] events from sliding sync RoomData
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	async loadFromSlidingSync(matrixEvents: MatrixEvent[]): Promise<string | undefined> {
		logger.info(`Loading events from sliding sync`);
		if (!matrixEvents || matrixEvents.length === 0) return undefined;

		// Related Events
		const relatedEvents = matrixEvents.filter((event) => event.getContent()[RelationType.RelatesTo]);
		this.addRelatedEvents(relatedEvents);

		// Redacted Events
		const redactedEvents = matrixEvents.filter((event) => event.getType() === EventType.RoomRedaction);
		this.redactedEvents = [...this.redactedEvents, ...redactedEvents.map((x) => new TimelineEvent({ matrixEvent: x, roomId: this.roomId }))];

		// TODO this is now necessary for reactions that use RedactedEventIds, in the future refactor to use standard redactions
		// if the redacted event concerns a deleted reaction, put the id in the redactedEventIds
		this.redactedEvents.forEach((redacted) => {
			if (
				redacted.matrixEvent.getType() === MatrixEventType.RoomRedaction &&
				redacted.matrixEvent.getContent()?.[Redaction.Reason] === Redaction.Deleted
			) {
				const deletedEvent = redacted.matrixEvent.getContent()?.[Redaction.Redacts];
				if (!this.redactedEventIds.some((x) => x === deletedEvent)) {
					this.redactedEventIds.push(deletedEvent);
				}
			}
		});

		// Filters out the Library events
		const libraryEvents = matrixEvents.filter(
			(x) =>
				(x.getType() === PubHubsMgType.LibraryFileMessage || x.getType() === PubHubsMgType.SignedFileMessage) &&
				x.getType() !== Redaction.DeletedFromLibrary &&
				x.getType() !== Redaction.Redacts,
		);
		this.fileLibraryAddEvents(libraryEvents.map((x) => new TimelineEvent({ matrixEvent: x, roomId: this.roomId })));

		this.applyIsDeleted([...this.timelineEvents, ...this.libraryEvents]);

		matrixEvents = matrixEvents.filter((event) => event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] !== RelationType.Thread);

		// Filters out the visible events, so from now on we are working on the visible timeline
		matrixEvents = this.prepareEvents(matrixEvents);
		if (matrixEvents.length === 0) return undefined;

		const eventList = matrixEvents.map((event) => new TimelineEvent({ matrixEvent: event, roomId: this.roomId }));

		// if the lastMessageId is undefined
		// or this events contains the lastMessageId
		// or one of the events is of the own user,
		// than we can add the new events
		if (
			this.paginationState.lastMessageId === undefined ||
			this.timelineEvents.some((x) => x.matrixEvent.getId() === this.paginationState.lastMessageId) ||
			eventList.some((x) => x.matrixEvent.getSender() === this.user.userId)
		) {
			this.paginationState.lastMessageId = eventList[eventList.length - 1]?.matrixEvent.getId();
			if (this.timelineEvents.length === 0) {
				const lastEventId = eventList[eventList.length - 1].matrixEvent.getId();
				if (lastEventId) {
					await this.loadToEvent({ eventId: lastEventId });
				}
				return eventList[eventList.length - 1]?.matrixEvent.getId();
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
				x.matrixEvent.getContent()?.[Redaction.Redacts] === eventId &&
				x.matrixEvent.getType() === MatrixEventType.RoomRedaction &&
				(x.matrixEvent.getContent()?.[Redaction.Reason] === Redaction.Deleted ||
					x.matrixEvent.getContent()?.[Redaction.Reason] === Redaction.DeletedFromThread ||
					x.matrixEvent.getContent()?.[Redaction.Reason] === Redaction.DeletedFromLibrary),
		);
		return !!redactedEvent;
	}

	/**
	 * Set isDeleted true for all deleted events in this.timelineEvents
	 */
	private applyIsDeleted(events: TimelineEvent[]) {
		events.forEach((x) => {
			const eventId = x.matrixEvent.getId();
			x.isDeleted = eventId ? this.IsDeletedEvent(eventId) : false;
		});
	}

	public getEvents(): TimelineEvent[] {
		return this.timelineEvents;
	}

	/**
	 * Returns a copy of the timeline events sorted chronologically (oldest first)
	 */
	public getChronologicalTimeline(): TimelineEvent[] {
		return [...this.timelineEvents].sort((a, b) => a.matrixEvent.getTs() - b.matrixEvent.getTs());
	}

	/**
	 * Returns the current timeline version counter.
	 */
	public getTimelineVersion(): number {
		return this._timelineVersion;
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
		const timelineSet = room.getOrCreateFilteredTimelineSet(this.getMessagesFilter());

		return (await this.client.getEventTimeline(timelineSet, eventId)) ?? null;
	}

	/**
	 * Paginate from event in given direction for a {limit} number of events
	 * @param direction
	 * @param limit
	 * @param timeline
	 * @returns
	 */
	private async performPaginate(direction: Direction, limit: number, timeline: EventTimeline): Promise<MatrixEvent[]> {
		const paginationToken =
			direction === Direction.Backward ? timeline.getPaginationToken(EventTimeline.BACKWARDS) : timeline.getPaginationToken(EventTimeline.FORWARDS);
		const messagesResponse = await this.client.createMessagesRequest(this.roomId, paginationToken, limit, direction, this.MessageFilter);

		const eventMapper = this.client.getEventMapper();
		const newEvents = messagesResponse.chunk.map((x: IRoomEvent) => eventMapper(x));

		if (messagesResponse.chunk.length < limit) {
			const firstMessageId = newEvents.length > 0 ? newEvents[0]?.event?.event_id : this.timelineEvents[0]?.matrixEvent.event?.event_id;
			const lastMessageId =
				newEvents.length > 0
					? newEvents[newEvents.length - 1]?.event?.event_id
					: this.timelineEvents[this.timelineEvents.length - 1]?.matrixEvent.event?.event_id;
			if (direction === Direction.Backward) {
				this.paginationState.firstMessageId = firstMessageId;
			} else {
				this.paginationState.lastMessageId = lastMessageId;
			}
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
		const newIds = new Set(newEvents.map((e) => e.matrixEvent.getId()));
		// Find index of first overlapping event in `events`
		const overlapIndex = events.findIndex((e) => newIds.has(e.matrixEvent.getId()));
		if (overlapIndex === -1) {
			// No overlap — fallback to slicing from start or end
			const currentEvents =
				direction === Direction.Backward
					? events.slice(-Math.max(0, limit - newEvents.length))
					: events.slice(0, Math.max(0, limit - newEvents.length));
			if (direction === Direction.Backward) {
				return [...newEvents, ...currentEvents];
			} else {
				return [...currentEvents, ...newEvents];
			}
		}

		// Filter out duplicates
		const filteredEvents = events.filter((e) => !newIds.has(e.matrixEvent.getId()));

		// Select filler based on direction
		let currentEvents: TimelineEvent[] = [];
		if (direction === Direction.Backward) {
			//if overlapIndex is null, then fill from the back
			if (overlapIndex > 0) {
				currentEvents = filteredEvents.slice(0, overlapIndex).slice(-Math.max(0, limit - newEvents.length));
			} else {
				currentEvents = filteredEvents.slice(0, overlapIndex).slice(-Math.max(0, limit - newEvents.length));
				const reversedIndex = [...events].reverse().findIndex((e) => newIds.has(e.matrixEvent.getId()));
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
			this._timelineVersion++;
		} else {
			// Snapshot timelineEvents IDs before fetching
			const beforeIds = this.timelineEvents.map((e) => e.matrixEvent.getId()).filter((id): id is string => typeof id === 'string');
			const allEvents = await this.performPaginate(direction, limit, timeline);

			// Only take events that are truly new
			const newOnly = allEvents.filter((e) => !beforeIds.find((x) => x === e.getId()));

			if (newOnly.length > 0) {
				let newTimeLineEvents = newOnly.map((event) => new TimelineEvent({ matrixEvent: event, roomId: this.roomId }));

				// Remove duplicates already in the managed timeline
				newTimeLineEvents = newTimeLineEvents.filter(
					(x) => !this.timelineEvents.some((existing) => existing.matrixEvent.getId() === x.matrixEvent.getId()),
				);

				if (newTimeLineEvents.length > 0) {
					if (direction === Direction.Backward) {
						this.timelineEvents = [...newTimeLineEvents, ...this.timelineEvents];
					} else {
						this.timelineEvents = [...this.timelineEvents, ...newTimeLineEvents];
					}

					// Enforce sliding window: trim from the opposite end
					if (this.timelineEvents.length > SystemDefaults.roomTimelineLimit) {
						if (direction === Direction.Forward) {
							this.timelineEvents = this.timelineEvents.slice(-SystemDefaults.roomTimelineLimit);
						}
					}

					this._timelineVersion++;
				}
			}
		}
	}

	/**
	 * Is the oldest message in the room loaded in the timeline?
	 * @returns
	 */
	public isOldestMessageLoaded(): boolean {
		return this.paginationState.firstMessageId === undefined
			? false
			: this.timelineEvents.some((x) => x.matrixEvent.getId() === this.paginationState.firstMessageId);
	}

	/**
	 * Is the newest message in the room loaded in the timeline?
	 * @returns
	 */
	public isNewestMessageLoaded(): boolean {
		return this.paginationState.lastMessageId === undefined
			? false
			: this.timelineEvents.some((x) => x.matrixEvent.getId() === this.paginationState.lastMessageId);
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
		return this.timelineEvents[this.timelineEvents.length - 1]?.matrixEvent.getId();
	}

	/**
	 *
	 * @param eventId eventId to find
	 * @returns TimelineEvent | undefined
	 */
	public findTimelineEventById(eventId: string | undefined): TimelineEvent | undefined {
		logger.info(`find timelineEvent by eventId ${eventId}...`, { eventId });
		return this.timelineEvents?.find((x) => x.matrixEvent.getId() === eventId);
	}

	/**
	 * Tries to find an event in the timeline by its Id
	 * @param eventId eventId to find
	 * @returns MatrixEvent | undefined
	 */
	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		logger.info(`find by eventId ${eventId}...`, { eventId });
		return this.findTimelineEventById(eventId)?.matrixEvent;
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
