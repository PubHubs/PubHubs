// Packages
import { Direction, EventTimeline, EventType, Filter, type IRoomEvent, type MatrixClient, type MatrixEvent } from 'matrix-js-sdk';

// Stores
import { useMatrix } from '@hub-client/composables/matrix.composable';

// Logic
import { PubHubsMgType } from '@hub-client/logic/core/events';
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { MatrixEventType, Redaction, type RelatedEventsOptions, RelationType, SystemDefaults } from '@hub-client/models/constants';
import { type TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { type TTextMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { isVisibleEvent } from '@hub-client/models/events/isVisibleEvent';
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

	/**
	 * Visible events only (filtered through isVisibleEvent), kept ascending by
	 * ts (oldest first). Readers may rely on the invariant: events[length - 1]
	 * is the newest known visible event.
	 */
	private _timelineEvents: TimelineEvent[] = [];

	private get timelineEvents(): TimelineEvent[] {
		return this._timelineEvents;
	}

	/** WARNING: the array you pass is used as-is; make sure it is not modified later. */
	private set timelineEvents(events: TimelineEvent[]) {
		events.sort((a, b) => a.matrixEvent.getTs() - b.matrixEvent.getTs());
		this._timelineEvents = events;
	}
	/** Increasing version counter, bumped on every timeline mutation */
	private _timelineVersion: number = 0;
	/** Contains all redacted events, deletions and edits */
	private redactedEvents: TimelineEvent[] = [];
	/** Contains all roomlibrary events */
	private libraryEvents: TimelineEvent[] = [];

	/** Contains all related events: reactions, annotations etc. */
	private relatedEvents: TRelatedEvents[] = [];
	// Contains related hide events
	private hideMessageEvents: Map<string, MatrixEvent> = new Map();
	// Latest m.replace edit event per target eventId (used to merge edited content into the original)
	private editEvents: Map<string, MatrixEvent> = new Map();

	private roomId: string;

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
	private redactedEventIds: string[] = [];

	/** roomTimelineKey of the sliding sync subscription of this timelinemanager */
	private roomTimelineKey: string | undefined;

	// Filter on timeline for messages
	private readonly timelineFilter: TimelineFilter = {
		room: {
			timeline: {
				types: [EventType.RoomMessage, EventType.RoomRedaction],
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
	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		return isVisibleEvent(event, this.user.userId);
	}

	/**
	 * Returns whether a moderator has hidden this event,
	 * and shows the label if it is defined.
	 */
	public getHideState(eventId: string): { isHidden: boolean; label?: string } {
		const event = this.hideMessageEvents.get(eventId);
		return {
			isHidden: event?.getContent()?.[RelationType.RelatesTo]?.rel_type === RelationType.Hide,
			label: event?.getContent()?.ph_hidden_label as string,
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

	private isHideMessageEvent(event: MatrixEvent): boolean {
		return event.getContent()?.msgtype === PubHubsMgType.HideMessage;
	}

	private updateHideMessageEvent(event: MatrixEvent): void {
		if (!this.isHideMessageEvent(event)) return;
		const targetEventId = event.getContent()?.[RelationType.RelatesTo]?.event_id;
		if (!targetEventId) return;
		const existing = this.hideMessageEvents.get(targetEventId);
		if (!existing || (event.getTs() ?? 0) > (existing.getTs() ?? 0)) {
			this.hideMessageEvents.set(targetEventId, event);
		}
	}

	private isEditEvent(event: MatrixEvent): boolean {
		return event.getContent()?.[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Replace;
	}

	/** Records the latest (by ts) m.replace edit for its target event. */
	private updateEditEvent(event: MatrixEvent): void {
		if (!this.isEditEvent(event)) return;
		const targetEventId = event.getContent()?.[RelationType.RelatesTo]?.event_id;
		if (!targetEventId) return;
		const existing = this.editEvents.get(targetEventId);
		if (!existing || (event.getTs() ?? 0) > (existing.getTs() ?? 0)) {
			this.editEvents.set(targetEventId, event);
		}
	}

	/**
	 * Applies pending m.replace edits to their target events: overwrites the original content
	 * with `m.new_content` (preserving the original relation so replies/threads keep their context),
	 * regenerates the processed body via a fresh TimelineEvent wrapper and stamps `ph_edited_ts`.
	 * Mirrors applyIsDeleted. The original content is overwritten, so it is never rendered.
	 * Targets not in the managed timeline (e.g. thread replies) are still updated via the SDK room.
	 * @returns ids of events whose content changed, so callers can refresh other views (e.g. threads)
	 */
	private applyEdits(): string[] {
		if (this.editEvents.size === 0) return [];
		const room = this.client.getRoom(this.roomId);
		const changedIds: string[] = [];

		for (const [targetEventId, editEvent] of this.editEvents) {
			const editTs = editEvent.getTs() ?? 0;

			// Prefer the managed timeline (so we can swap the wrapper for reactivity), fall back to the SDK room.
			const index = this._timelineEvents.findIndex((e) => e.matrixEvent.getId() === targetEventId);
			const target = index !== -1 ? this._timelineEvents[index].matrixEvent : room?.findEventById(targetEventId);
			if (!target) continue;

			if (editEvent.getSender() !== target.getSender()) {
				logger.warn(`Skipping edit: sender mismatch (edit from ${editEvent.getSender()}, original from ${target.getSender()})`);
				continue;
			}

			const currentContent = target.event.content as TTextMessageEventContent | undefined;
			// Skip when this (or a newer) edit was already applied.
			if (currentContent?.ph_edited_ts !== undefined && currentContent.ph_edited_ts >= editTs) continue;

			const newContent = editEvent.getContent()?.['m.new_content'] as TTextMessageEventContent | undefined;
			if (!newContent) continue;

			const originalRelatesTo = currentContent?.[RelationType.RelatesTo];
			target.event.content = {
				...newContent,
				...(originalRelatesTo ? { [RelationType.RelatesTo]: originalRelatesTo } : {}),
				ph_edited_ts: editTs,
			};

			if (index !== -1) {
				// Fresh wrapper re-runs the content transform (regenerates ph_body) and changes the prop
				// reference so the bubble re-renders.
				this._timelineEvents[index] = new TimelineEvent({ matrixEvent: target, roomId: this.roomId });
			}
			changedIds.push(targetEventId);
		}

		if (changedIds.length > 0) this._timelineVersion++;
		return changedIds;
	}

	private cleanupHideMessageEvents(): void {
		const timelineEventIds = new Set(this.timelineEvents.map((e) => e.matrixEvent.getId()));
		for (const targetEventId of this.hideMessageEvents.keys()) {
			if (!timelineEventIds.has(targetEventId)) {
				this.hideMessageEvents.delete(targetEventId);
			}
		}
	}

	/**
	 * Prepares the events for use in the room timeline: filters isVisible and sorts
	 * @param eventList eventlist coming from Sliding sync, to be prepared for use
	 * @returns eventList to use in the RoomTimeline
	 */
	private prepareEvents(eventList: MatrixEvent[]): MatrixEvent[] {
		eventList.forEach((e) => {
			this.updateHideMessageEvent(e);
			this.updateEditEvent(e);
		});
		return eventList.filter((event) => this.isVisibleEvent(event.event)).sort((a, b) => a.getTs() - b.getTs());
	}

	// Add events to the relatedEvents
	// only when the event is not in there already
	// The array of relatedEvents is sorted on timestamp (oldest -> newest)
	private async addRelatedEvents(events: MatrixEvent[]) {
		if (events.length <= 0) return;

		for (const eventToAdd of events) {
			this.updateHideMessageEvent(eventToAdd);
			this.updateEditEvent(eventToAdd);
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

		// only add what isn't there yet
		const existingIds = new Set(this.timelineEvents.map((x) => x.matrixEvent.getId()));
		const newOnly = eventList.filter((x) => !existingIds.has(x.matrixEvent.getId()));
		this.timelineEvents = [...this.timelineEvents, ...newOnly];

		this.applyEdits();
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

		return this.commitTimelineEvents(tempEvents);
	}

	/**
	 * Maps events into the visible timeline, caps it to the window size and refreshes derived state
	 * (hidden messages, edits, timeline version). Shared by the initial-load paths.
	 */
	private commitTimelineEvents(events: MatrixEvent[]): TimelineEvent[] {
		let mappedEvents = events.map((event) => new TimelineEvent({ matrixEvent: event, roomId: this.roomId }));
		mappedEvents = this.ensureListLength(this.timelineEvents, mappedEvents, SystemDefaults.roomTimelineLimit, Direction.Backward);
		this.timelineEvents = mappedEvents;
		this.cleanupHideMessageEvents();
		this.applyEdits();
		this._timelineVersion++;
		return mappedEvents;
	}

	/**
	 * Seeds the timeline synchronously from events already held in the SDK live timeline.
	 *
	 * The main sliding-sync list delivers the latest events of every room into the SDK before the
	 * room is opened (see Room.unreadState), so on first open these are already available and we can
	 * render immediately without a network round-trip. Older history is filled afterwards by the
	 * scroll pagination observer.
	 *
	 * @returns the number of visible events that were seeded
	 */
	public seedFromLiveTimeline(): number {
		const room = this.client?.getRoom(this.roomId);
		if (!room) return 0;

		// prepareEvents sorts oldest -> newest; the SDK live timeline is not guaranteed to be ordered by ts
		const visibleEvents = this.prepareEvents(room.getLiveTimeline().getEvents());
		if (visibleEvents.length === 0) return 0;

		const committed = this.commitTimelineEvents(visibleEvents);

		// The list is sorted by recency, so the newest event of the room is loaded
		this.paginationState.lastMessageId = committed[committed.length - 1]?.matrixEvent.getId();

		return visibleEvents.length;
	}

	/**
	 * Loads the most recent messages of the room in a single backward pass from the live end.
	 *
	 * Used for the initial load when opening a room. It replaces the previous
	 * "fetch newest event id -> getEventTimeline(context) -> paginate both directions" sequence,
	 * which needed three or more sequential round-trips before the timeline could render.
	 * Starting at the live end (token = null) and paginating only backward, this needs just enough
	 * requests to collect `initialRoomTimelineLimit` visible events, usually a single one.
	 */
	public async loadLatestTimeline(): Promise<TimelineEvent[]> {
		let collected: MatrixEvent[] = [];
		let currentToken: string | null = null;
		let iterations = 0;
		let reachedEnd = false;

		while (collected.length < SystemDefaults.initialRoomTimelineLimit && iterations < SystemDefaults.maxPaginationIterations && !reachedEnd) {
			iterations++;
			const messagesResponse = await this.client.createMessagesRequest(
				this.roomId,
				currentToken,
				SystemDefaults.initialRoomTimelineLimit,
				Direction.Backward,
				this.MessageFilter,
			);

			const eventMapper = this.client.getEventMapper();
			const newEvents = messagesResponse.chunk.map((x: IRoomEvent) => eventMapper(x));

			// prepareEvents sorts each batch oldest -> newest, so prepending successive (older) batches keeps order
			const visibleEvents = this.prepareEvents(newEvents);
			collected = [...visibleEvents, ...collected];

			currentToken = messagesResponse.end ?? null;
			if (!messagesResponse.end || messagesResponse.chunk.length < SystemDefaults.initialRoomTimelineLimit) {
				reachedEnd = true;
				this.paginationState.firstMessageId = collected[0]?.getId();
			}
		}

		// We started at the live end, so the newest message is loaded
		this.paginationState.lastMessageId = collected[collected.length - 1]?.getId();

		return this.commitTimelineEvents(collected);
	}

	/**
	 * Loads timeline from the subscribed rooms in sliding sync
	 * @param matrixEvent[] events from sliding sync RoomData
	 * @returns string | undefined - the Id of the event to scroll the roomtimeline to
	 */
	async loadFromSlidingSync(matrixEvents: MatrixEvent[]): Promise<string | undefined> {
		logger.info(`Loading events from sliding sync`);
		if (!matrixEvents || matrixEvents.length === 0) return undefined;

		// m.replace edits: capture and apply synchronously here, before the visible-event early-return below
		// (an edit-only batch filters down to zero visible events). Edits whose target is not loaded yet
		// stay in editEvents and are applied later by applyEdits() in the add/paginate paths.
		matrixEvents.forEach((e) => this.updateEditEvent(e));
		this.applyEdits();

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
			let scrollToEventId: string | undefined;
			if (this.timelineEvents.length === 0) {
				const lastEventId = eventList[eventList.length - 1].matrixEvent.getId();
				if (lastEventId) {
					await this.loadToEvent({ eventId: lastEventId });
				}
				scrollToEventId = eventList[eventList.length - 1]?.matrixEvent.getId();
			} else {
				scrollToEventId = await this.addEventList(eventList);
			}
			return scrollToEventId;
		}
		return undefined;
	}

	/**
	 * Checks if there is a redaction event of type Deleted or DeletedFromThread for a certain event
	 * @param eventId
	 * @returns True if it is deleted
	 */
	public IsDeletedEvent(eventId: string): boolean {
		return !!this.getRedactionEvent(eventId);
	}

	/**
	 * Gets the redaction event for a given event ID
	 * @param eventId
	 * @returns The redaction TimelineEvent or undefined
	 */
	private getRedactionEvent(eventId: string): TimelineEvent | undefined {
		if (this.redactedEvents.length <= 0) return undefined;
		return this.redactedEvents.find(
			(event) =>
				event.matrixEvent.getContent()?.[Redaction.Redacts] === eventId &&
				event.matrixEvent.getType() === MatrixEventType.RoomRedaction &&
				event.matrixEvent.getContent()?.[Redaction.Reason],
		);
	}

	/**
	 * Set isDeleted true for all deleted events and apply redaction via SDK
	 * so Message.vue can determine if deletion was by steward
	 */
	private applyIsDeleted(events: TimelineEvent[]) {
		const room = this.client.getRoom(this.roomId);

		events.forEach((event) => {
			const eventId = event.matrixEvent.getId();
			if (!eventId) {
				event.isDeleted = false;
				return;
			}

			const redactionEvent = this.getRedactionEvent(eventId);
			event.isDeleted = !!redactionEvent;

			// Use SDK's makeRedacted to properly set unsigned.redacted_because
			// This allows Message.vue to determine if the event is deleted by a steward
			if (redactionEvent && room && !event.matrixEvent.isRedacted()) {
				event.matrixEvent.makeRedacted(redactionEvent.matrixEvent, room);
			}
		});
	}

	public getEvents(): TimelineEvent[] {
		return this.timelineEvents;
	}

	/**
	 * @deprecated `timelineEvents` is now sorted ascending by ts as an invariant
	 * (see the setter), so this method is a redundant alias for getEvents().
	 * Kept temporarily; call sites should be migrated to getEvents() and this
	 * method removed.
	 */
	public getChronologicalTimeline(): TimelineEvent[] {
		return this.timelineEvents;
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
	 * Removes a library event by eventId and bumps the timeline version
	 * @param eventId The event ID to remove
	 */
	public removeLibraryEvent(eventId: string): void {
		const index = this.libraryEvents.findIndex((e) => e.matrixEvent.getId() === eventId);
		if (index !== -1) {
			this.libraryEvents.splice(index, 1);
			this._timelineVersion++;
		}
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
	 * Paginate from event in given direction for a {limit} number of VISIBLE events.
	 * Continues fetching until enough visible events are collected or the timeline end is reached.
	 * @param direction - Direction to paginate
	 * @param limit - Number of visible events to fetch
	 * @param timeline - The timeline to paginate from
	 * @returns Array of visible MatrixEvents
	 */
	private async performPaginate(direction: Direction, limit: number, timeline: EventTimeline): Promise<MatrixEvent[]> {
		let iterations = 0;
		let allVisibleEvents: MatrixEvent[] = [];
		let currentToken: string | null =
			direction === Direction.Backward ? timeline.getPaginationToken(EventTimeline.BACKWARDS) : timeline.getPaginationToken(EventTimeline.FORWARDS);
		let reachedEnd = false;

		while (allVisibleEvents.length < limit && iterations < SystemDefaults.maxPaginationIterations && !reachedEnd) {
			iterations++;
			const messagesResponse = await this.client.createMessagesRequest(this.roomId, currentToken, limit, direction, this.MessageFilter);

			const eventMapper = this.client.getEventMapper();
			const newEvents = messagesResponse.chunk.map((x: IRoomEvent) => eventMapper(x));

			// Check if we've reached the end of the timeline
			if (messagesResponse.chunk.length < limit) {
				reachedEnd = true;
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

			// Filter to visible events and add to collection
			const visibleEvents = this.prepareEvents(newEvents);
			if (direction === Direction.Backward) {
				allVisibleEvents = [...visibleEvents, ...allVisibleEvents];
			} else {
				allVisibleEvents = [...allVisibleEvents, ...visibleEvents];
			}

			// Update token for next iteration
			currentToken = messagesResponse.end ?? null;

			// If no token returned, we've reached the end
			if (!messagesResponse.end) {
				reachedEnd = true;
			}
		}

		logger.info(`performPaginate: fetched ${allVisibleEvents.length} visible events in ${iterations} iteration(s)`);
		return allVisibleEvents;
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
			this.hideMessageEvents.clear();
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

					this.cleanupHideMessageEvents();
					this._timelineVersion++;
				}
			}
			// Replace events fetched during pagination are captured in prepareEvents but filtered from the
			// visible list; apply them (also covers edits of events just added above).
			this.applyEdits();
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
