// Packages
import { Direction, EventTimeline, EventTimelineSet, EventType, IStateEvent, MatrixClient, MatrixEvent, Room as MatrixRoom, RoomMember as MatrixRoomMember, MsgType, NotificationCountType, Thread, ThreadEvent } from 'matrix-js-sdk';
import { CachedReceipt, WrappedReceipt } from 'matrix-js-sdk/lib/@types/read_receipts';
import { MSC3575RoomData as SlidingSyncRoomData } from 'matrix-js-sdk/lib/sliding-sync';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';
import { useRoomLibrary } from '@hub-client/composables/useRoomLibrary';

// Logic
import { LOGGER } from '@hub-client/logic/logging/Logger';
import { SMI } from '@hub-client/logic/logging/StatusMessage';

import { Redaction, RelationType, SystemDefaults } from '@hub-client/models/constants';
// Models
import { TBaseEvent } from '@hub-client/models/events/TBaseEvent';
import { TMessageEvent, TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { TCurrentEvent } from '@hub-client/models/events/types';
import RoomMember, { type RoomMemberStateEvent } from '@hub-client/models/rooms/RoomMember';
import { TRoomMember } from '@hub-client/models/rooms/TRoomMember';
import TRoomThread from '@hub-client/models/thread/RoomThread';
import { TimelineManager } from '@hub-client/models/timeline/TimelineManager';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';

// Types
enum RoomType {
	SECURED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
	PH_MESSAGE_ADMIN_CONTACT = 'ph.messages.admin.contact',
	PH_MESSAGE_STEWARD_CONTACT = 'ph.messages.steward.contact',
}

type RoomThread = {
	threadId: string;
	rootEvent: MatrixEvent | undefined;
	thread: TRoomThread | undefined;
	threadLength: number;
};

type NewReplyListener = (thread: Thread, threadEvent: MatrixEvent) => void;
type UpdateReplyListener = (thread: Thread) => void;

const BotName = {
	NOTICE: 'notices',
	SYSTEM: 'system_bot',
};

/**
 * Our model of a room based on matrix rooms with some added functionality.
 * It uses the matrix-js-sdk's Room class under the hood.
 *
 */
export default class Room {
	public matrixRoom: MatrixRoom;

	// keep track of 'removed' rooms that are not synced yet.
	private hidden: boolean;

	public numUnreadMessages: number;

	// Threads/Events, public for vue reactivity
	public currentThread: RoomThread | undefined = undefined;
	public currentEvent: TCurrentEvent | undefined = undefined;
	//public threadUpdated: Ref<boolean> = ref(false); // toggle to indicate changed thread to vue components
	public threadUpdated: boolean = false; // toggle to indicate changed thread to vue components

	// timelinemanager of currently shown events
	private timelineManager: TimelineManager;

	// Keep track of first visible message on screen with eventId and its timestamp.
	// This is used for observing (or detecting) first and last visible message on viewport.
	private firstVisibleTimeStamp: number;
	private firstVisibleEventId: string;

	private lastVisibleTimeStamp: number;
	private lastVisibleEventId: string;

	private roomType: string;

	private pubhubsStore;
	private matrixFiles = useMatrixFiles();

	private roomMembers: Map<string, RoomMember> = new Map();

	/** Contains all related events for an event. New related event for an event only stores the last event not the history */
	private eventMultipleRelateEvents: MatrixEvent[] = [];

	private stateEvents: IStateEvent[];

	logger = LOGGER;

	private roomLibrary;

	constructor(matrixRoom: MatrixRoom);
	constructor(matrixRoom: MatrixRoom, roomType: string, stateEvents: IStateEvent[]);
	constructor(matrixRoom: MatrixRoom, roomType?: string, stateEvents?: IStateEvent[]) {
		LOGGER.trace(SMI.ROOM, `Roomclass Constructor `, {
			roomId: matrixRoom.roomId,
		});

		this.matrixRoom = matrixRoom;
		this.hidden = false;
		this.numUnreadMessages = 0;

		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;

		this.lastVisibleEventId = '';
		this.lastVisibleTimeStamp = 0;

		this.roomType = roomType ?? '';

		// TODO Sliding Sync: Should not simply assign, but look per item if already present and then modify or add
		this.stateEvents = stateEvents ?? [];

		this.pubhubsStore = usePubhubsStore();
		this.roomLibrary = useRoomLibrary();
		this.matrixFiles = useMatrixFiles();

		this.timelineManager = new TimelineManager(this.matrixRoom.roomId, this.matrixRoom.client as MatrixClient);
		this.matrixRoom.createThreadsTimelineSets(); // using threads we need to create the timeline sets for them
	}

	public isPrivateRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGES_DM;
	}

	public isGroupRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGES_GROUP;
	}

	public isAdminContactRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGE_ADMIN_CONTACT;
	}

	public isStewardContactRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGE_STEWARD_CONTACT;
	}

	public isSecuredRoom(): boolean {
		return this.getType() === RoomType.SECURED;
	}

	public directMessageRoom(): boolean {
		return this.isPrivateRoom() || this.isAdminContactRoom() || this.isStewardContactRoom() || this.isGroupRoom();
	}

	// #region getters and setters
	get roomId(): string {
		return this.matrixRoom.roomId;
	}

	get name(): string {
		// in Matrix initially the name of the rooom is the Id, only by joining the room the name is calculated
		return this.matrixRoom.name;
	}

	set name(name: string) {
		this.matrixRoom.name = name;
	}

	public setHidden(hiddenState: boolean) {
		this.hidden = hiddenState;
	}

	public isHidden(): boolean {
		return this.hidden;
	}

	public setFirstVisibleTimeStamp(visibleTimeStamp: number) {
		this.firstVisibleTimeStamp = visibleTimeStamp;
	}

	public setLastVisibleTimeStamp(visibleTimeStamp: number) {
		this.lastVisibleTimeStamp = visibleTimeStamp;
	}

	public setFirstVisibleEventId(visibleEventId: string) {
		this.firstVisibleEventId = visibleEventId;
	}

	public setLastVisibleEventId(visibleEventId: string) {
		this.lastVisibleEventId = visibleEventId;
	}

	public setCurrentEvent(event: TCurrentEvent | undefined) {
		this.currentEvent = event;
	}

	public addCurrentEventToRelatedEvent(event: MatrixEvent) {
		if (this.eventMultipleRelateEvents.indexOf(event) === -1) {
			this.eventMultipleRelateEvents.push(event);
		}
	}

	public getCurrentEventRelatedEvents(): MatrixEvent[] {
		return this.eventMultipleRelateEvents;
	}

	public getFirstVisibleEventId(): string {
		return this.firstVisibleEventId;
	}

	public getFirstVisibleTimeStamp(): number {
		return this.firstVisibleTimeStamp;
	}

	public getLastVisibleEventId(): string {
		return this.lastVisibleEventId;
	}

	public getLastVisibleTimeStamp(): number {
		return this.lastVisibleTimeStamp;
	}

	public getCurrentEvent() {
		return this.currentEvent;
	}

	public resetFirstVisibleEvent() {
		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;
	}

	public getPowerLevel(user_id: string): number {
		const member = this.matrixRoom.getMember(user_id);
		if (member) {
			return member.powerLevel;
		}
		// If user is not a member.
		return -1;
	}

	public getType(): string | undefined {
		return this.matrixRoom.getType() || this.roomType;
	}

	public getCreator(): string | null {
		return this.matrixRoom.getCreator();
	}

	public getTopic(): string {
		const timeline = this.matrixRoom.getLiveTimeline();
		let topic = '';
		if (timeline !== undefined) {
			const topicEvent = timeline.getState(EventTimeline.FORWARDS)?.getStateEvents('m.room.topic', '');
			if (topicEvent) {
				topic = topicEvent.getContent().topic;
			}
		}
		return topic;
	}

	// #endregion

	// #reaction region  ///

	public ifLastEventHasReaction(eventId: string): boolean {
		const lastMessageEventId = this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.filter((event) => event.getType() === EventType.RoomMessage)
			.at(-1)?.event.event_id;
		const reactEvent = this.getReactEventsFromTimeLine().find((event) => event.event.event_id === eventId);
		if (reactEvent) {
			const eventIdForMessage = reactEvent.getContent()[RelationType.RelatesTo]?.event_id;
			if (eventIdForMessage === lastMessageEventId) {
				return true;
			}
		}
		return false;
	}

	/**
	 *  Gets reaction event based on relation event Id
	 * @param eventId string Relation Event Id
	 * @returns MatrixEvent event of type Reaction.
	 */
	public getReactionEvent(eventId: string) {
		return this.getReactEventsFromTimeLine().filter((reactEvent) => reactEvent.getContent()[RelationType.RelatesTo]?.event_id === eventId);
	}

	// #endregion

	// #region members

	// Sliding sync state methods //

	public getStateMember(): RoomMemberStateEvent[];
	public getStateMember(userId?: string): RoomMemberStateEvent | RoomMemberStateEvent[] | undefined {
		if (userId !== undefined) {
			// Return a single member or undefined if not found
			return this.stateEvents.find((event) => event.type === EventType.RoomMember && event.state_key === userId) as RoomMemberStateEvent;
		} else {
			// Return all members
			return this.stateEvents.filter((event) => event.type === EventType.RoomMember) as RoomMemberStateEvent[];
		}
	}

	public getStateJoinedMembersIds(): string[] {
		return this.stateEvents.filter((item) => item.content.membership === 'join' || item.content.membership === 'invite').map((item) => item.sender);
	}

	public getStateJoinedMembers(): RoomMemberStateEvent[] {
		return this.stateEvents.filter((item) => item.content.membership === 'join' || item.content.membership === 'invite') as RoomMemberStateEvent[];
	}

	public getStateMemberPowerLevel(userId: string): number | null {
		const event = this.stateEvents.filter((event) => event.type === EventType.RoomPowerLevels).find((event) => event.content.users);

		if (!event) return null;
		return event.content.users[userId] ?? event.content.users_default;
	}

	// End of sliding sync state methods //

	/**
	 * @param getPHRoomMember Set to true to update to using the PubHubs RoomMember class instead of matrix-js-sdk RoomMember class.
	 */
	public getMember(userId: string): MatrixRoomMember | null;
	public getMember(userId: string, getPHRoomMember: true): RoomMember | null;
	public getMember(userId: string, getPHRoomMember = false): MatrixRoomMember | RoomMember | null {
		if (!getPHRoomMember) return this.matrixRoom.getMember(userId);

		const member = this.roomMembers.get(userId);
		if (member) return member;

		const matrixRoomMember = this.matrixRoom.getMember(userId);
		if (!matrixRoomMember) return null;

		const roomMember = new RoomMember(matrixRoomMember);
		this.roomMembers.set(userId, roomMember);
		return roomMember;
	}

	/**
	 * Gets all joined members of the room except the current user or any bots.
	 */
	public getOtherJoinedMembers(): TRoomMember[] {
		return this.getOtherMembers(this.matrixRoom.getMembersWithMembership('join'));
	}

	public getOtherInviteMembers(): TRoomMember[] {
		return this.getOtherMembers(this.matrixRoom.getMembersWithMembership('invite'));
	}

	/**
	 * Gets all joined and invited members of the room except the current user or any bots.
	 */
	public getOtherJoinedAndInvitedMembers(): TRoomMember[] {
		return this.getOtherMembers(Array.from(new Set([...this.matrixRoom.getMembersWithMembership('join'), ...this.matrixRoom.getMembersWithMembership('invite')])));
	}

	private getOtherMembers(baseMembers: TRoomMember[]): TRoomMember[] {
		const currentUserId = this.matrixRoom.client.getUserId() || '';
		return baseMembers.filter((member) => member.userId !== currentUserId && !Object.values(BotName).includes(currentUserId));
	}

	public getMembersIds(): Array<string> {
		let roomMemberIds: string[] = this.stateEvents.filter((event) => event.type === EventType.RoomMember).map((member) => member.sender);

		// filter out (old) notice_users
		roomMemberIds = roomMemberIds.filter((id) => {
			return id.substring(0, 13) !== '@notices_user';
		});
		roomMemberIds.sort();
		return roomMemberIds;
	}

	// FIXME: Typing error
	public getRoomStewards(): Array<TRoomMember> {
		return this.getMembersIds()
			.map((member) => this.getMember(member))
			.filter((roomMember) => roomMember?.powerLevel === 50);
	}
	public getMembersIdsFromName(): Array<string> {
		const roomMemberIds = this.name.split(',');
		roomMemberIds.sort();
		return roomMemberIds;
	}

	public hasExactMembersInName(memberIds: Array<string>): boolean {
		const roomMemberIds = this.getMembersIdsFromName();
		return JSON.stringify(memberIds.sort()) === JSON.stringify(roomMemberIds);
	}

	public notInvitedMembersIdsOfPrivateRoom(): Array<string> {
		const currentMemberIds = this.getMembersIds();
		const nameMemberIds = this.getMembersIdsFromName();
		const notInvitedMembersIds = nameMemberIds.filter((item) => currentMemberIds.indexOf(item) < 0);
		notInvitedMembersIds.sort();
		return notInvitedMembersIds;
	}

	public userIsMember(user_id: string): boolean {
		const member = this.matrixRoom.getMember(user_id);
		return member !== null;
	}

	public userCanChangeName(user_id: string): boolean {
		const member = this.matrixRoom.getMember(user_id);

		if (member) {
			const sufficient = this.matrixRoom.getLiveTimeline().getState(EventTimeline.FORWARDS)?.hasSufficientPowerLevelFor('redact', member?.powerLevel);
			return sufficient || false;
		}
		return false;
	}

	// #endregion

	// #region events

	public hasEvents(): boolean {
		return this.matrixRoom.getLiveTimeline().getEvents().length > 0;
	}

	public hasMessages(): boolean {
		return this.timelineManager.getEvents().length > 0;
	}

	public numOfMessages(): number {
		return this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.filter((roomEvent) => roomEvent.getType() === EventType.RoomMessage).length;
	}

	/**
	 * Removes a single event from this room.
	 *
	 * @param eventId — The id of the event to remove
	 * @returns — true if the event was removed from any of the room's timeline sets
	 */
	public removeEvent(eventId: string): boolean {
		return this.matrixRoom.removeEvent(eventId);
	}

	/**
	 *
	 * Deletes a message and eventually the media/image file from the server
	 *
	 * @param event — The event to delete
	 * @param isThreadRoot — If given, the event has to be a rootevent of a thread which will also be deleted
	 * @param threadId — If given, the event is inside a thread
	 */
	public deleteMessage(event: TMessageEvent<TMessageEventContent>, isThreadRoot?: boolean, threadId?: string) {
		const messageType = event.content.msgtype;
		// If the message that will be deleted contains a file or image, delete this media from the server as well
		if ((messageType === MsgType.File || messageType === MsgType.Image) && event.content.url && event.content.url.length > 0) {
			const accessToken = this.pubhubsStore.Auth.getAccessToken();
			const req = new XMLHttpRequest();
			req.open('DELETE', this.matrixFiles.deleteMediaUrlfromMxc(event.content.url));
			req.setRequestHeader('Authorization', 'Bearer ' + accessToken);
			req.send();
		}

		// if event to be deleted is the current thread, clear the current thread
		if (this.currentThread?.threadId === event.event_id) {
			this.currentThread = undefined;
		}

		// If reactEvent exists, delete it with the message.
		const reactEventId = this.getReactionEvent(event.event_id) ? this.getReactionEvent(event.event_id).pop()?.getId() : null;

		// FIXME: Typing error
		const threadIdToDelete = isThreadRoot ? event.event_id : threadId;
		this.pubhubsStore.deleteMessage(this.matrixRoom.roomId, event.event_id, threadIdToDelete, reactEventId);
	}

	// #endregion

	// #region notification functions

	public resetUnreadMessages() {
		this.numUnreadMessages = 0;
	}

	public getReceiptForEvent(event: MatrixEvent): CachedReceipt[] {
		return this.matrixRoom.getReceiptsForEvent(event);
	}

	public getReadReceiptForUserId(userId: string): WrappedReceipt | null {
		return this.matrixRoom.getReadReceiptForUserId(userId);
	}

	public getEventReadUpTo(userId: string, ignoreSynthesized?: boolean) {
		return this.matrixRoom.getEventReadUpTo(userId, ignoreSynthesized);
	}

	public getRoomUnreadNotificationCount(type?: NotificationCountType): number {
		return this.matrixRoom.getRoomUnreadNotificationCount(type);
	}

	public getUnreadNotificationCount(type?: NotificationCountType): number {
		return this.matrixRoom.getUnreadNotificationCount(type);
	}

	public getThreadUnreadNotificationCount(threadId: string, type = NotificationCountType.Total): number {
		return this.matrixRoom.getThreadUnreadNotificationCount(threadId, type);
	}

	public hasUserReadEvent(userId: string, eventId: string): boolean {
		return this.matrixRoom.hasUserReadEvent(userId, eventId);
	}

	//#endregion

	// #region Timeline

	// Everything that happens on the live timeline, for tracking new messages
	// The liveTimeline contains all events and reflects the current state

	public getUnfilteredTimelineSet(): EventTimelineSet {
		return this.matrixRoom.getUnfilteredTimelineSet();
	}

	public getLiveTimelineEvents(): MatrixEvent[] {
		return this.timelineManager.getEvents().map((x) => x.matrixEvent);
		//return this.matrixRoom.getLiveTimeline().getEvents();
	}

	public getLiveTimelineNewestEvent(): Partial<TBaseEvent> | undefined {
		return this.timelineManager
			.getEvents()
			.map((x) => x.matrixEvent)
			.at(-1)?.event;
		//return this.matrixRoom.getLiveTimeline().getEvents().at(-1)?.event;
	}

	/*
	 * Grouping users and then selecting the latest related event.
	 */

	public filterRoomWidgetRelatedEvents(eventId: string): MatrixEvent[] {
		const relatedEvents = this.timelineManager.getRelatedEventForEvent(eventId);

		const latestEventsPerUser = Object.values(
			relatedEvents.reduce(
				(acc, event) => {
					const userId = event.getSender(); // or event.user_id if available
					if (!acc[userId] || acc[userId].event.origin_server_ts < event.event.origin_server_ts) {
						acc[userId] = event;
					}
					return acc;
				},
				{} as Record<string, MatrixEvent>,
			),
		);

		return latestEventsPerUser;
	}

	public getRelatedEvents(): MatrixEvent[] {
		return this.timelineManager.getTimeLineRelatedEvents().map((event) => event.matrixEvent);
	}

	public getReactEventsFromTimeLine(): MatrixEvent[] {
		return this.getLiveTimelineEvents().filter((event) => event.getType() === EventType.Reaction);
	}

	public getLivetimelineLength(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().length;
	}

	// #endregion

	// #region TimelineManager

	public initTimeline() {
		this.timelineManager.initRoomTimeline(this.matrixRoom.roomId);
	}

	public loadFromSlidingSync(roomData: SlidingSyncRoomData) {
		if (!roomData.timeline || roomData.timeline.length === 0) return;
		const eventList = roomData.timeline.map((event) => {
			return new MatrixEvent(event);
		});

		// Threads are kept on room-level, so all events regarding the current thread need to be filtered and handled first.

		// Handle thread redactions, for now only the DeletedFromThread events
		const redactions = eventList.filter((event) => event.getContent()?.[Redaction.Redacts] && event.getContent()?.[Redaction.Reason] === Redaction.DeletedFromThread);
		if (redactions.length > 0) {
			this.currentThread?.thread?.addRedactions(redactions);
		}
		// Handle thread events, only when they are from the currentthread (otherwise they will be fetched on opening the thread)
		const currentThreadEvents = eventList.filter(
			(event) => event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread && this.currentThread?.threadId === event.getContent()[RelationType.RelatesTo]?.[RelationType.EventId],
		);
		if (currentThreadEvents.length > 0) {
			this.currentThread!.thread!.addEvents(currentThreadEvents);
		}

		// set toggle to force vue component updates when something in the threads has changed, will also set current event for thread
		if (currentThreadEvents.length > 0 || redactions.length > 0) {
			this.threadUpdated = !this.threadUpdated;
		}

		// Handle all other events and redactions, not in a thread
		const nonThreadEvents = eventList.filter((event) => event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] !== RelationType.Thread).slice(-SystemDefaults.RoomTimelineLimit);
		this.timelineManager.loadFromSlidingSync(nonThreadEvents).then((scrollToEventId) => {
			if (scrollToEventId) {
				this.setCurrentEvent({ eventId: scrollToEventId });
			}
		});
	}

	public getTimeline(): TimelineEvent[] {
		return this.timelineManager.getEvents();
	}

	/**
	 *
	 * @returns The newest message event id in the default timeline
	 */
	public getTimelineNewestMessageEventId(): string | undefined {
		return this.timelineManager?.getTimelineNewestMessageId();
	}

	// #region RoomLibrary

	public loadRoomLibrary() {
		return this.roomLibrary.loadRoomLibraryTimeline(this.matrixRoom);
	}

	// #endregion

	// #region TimelineManager

	// The TimelineManager that controls the visible part of the timeline
	// this is filtered to show only messages and gets updated by sliding sync or pagination

	public async loadToEvent(currentEvent: TCurrentEvent) {
		await this.timelineManager?.loadToEvent(currentEvent);
	}

	public findEventById(eventId: string): MatrixEvent | undefined {
		return this.timelineManager?.findEventById(eventId);
	}

	public async paginate(direction: Direction, limit: number, fromEventId: string) {
		await this.timelineManager.paginate(direction, limit, fromEventId);
	}

	public isOldestMessageLoaded(): boolean {
		return this.timelineManager.isOldestMessageLoaded();
	}

	public isNewestMessageLoaded(): boolean {
		return this.timelineManager?.isNewestMessageLoaded();
	}

	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		return this.timelineManager.isVisibleEvent(event);
	}

	public getRoomOldestMessageId(): string | undefined {
		return this.timelineManager?.getRoomOldestMessageId();
	}

	public getRoomNewestMessageId(): string | undefined {
		return this.timelineManager?.getRoomNewestMessageId();
	}

	public getTimelineOldestMessageId(): string | undefined {
		return this.timelineManager?.getTimelineOldestMessageId();
	}

	public getTimelineNewestMessageId(): string | undefined {
		return this.timelineManager?.getTimelineNewestMessageId();
	}

	public getUserPowerLevel(userId: string | null): number {
		const timeline = this.matrixRoom.getLiveTimeline();
		if (timeline !== undefined && userId) {
			const powerLevelsEvent = timeline.getState(EventTimeline.FORWARDS)?.getStateEvents('m.room.power_levels', '');
			// If there is no power level then we return a -1 - An arbitrary number that is not a power level.
			// This should indicate that there is no power level event in the room hence an issue from synapse side.
			if (!powerLevelsEvent) return -1;
			const powerLevels = powerLevelsEvent.getContent();

			return powerLevels.users[userId];
		}
		return 0;
	}

	public inRedactedMessageIds(eventId: string): boolean {
		return this.timelineManager.getRedactedEventIds().includes(eventId);
	}

	public addToRedactedEventIds(eventId: string): void {
		this.timelineManager.getRedactedEventIds().push(eventId);
	}

	public isDeletedEvent(eventId: string) {
		return this.timelineManager.IsDeletedEvent(eventId);
	}

	// #endregion

	// #region Threads

	/**
	 * Passes listener to client
	 * @param newReplyListener Method to perform on ThreadEvent.NewReply
	 */
	public listenToThreadNewReply(newReplyListener: NewReplyListener) {
		this.matrixRoom.on(ThreadEvent.NewReply, newReplyListener);
	}

	public stopListeningToThreadNewReply(newReplyListener: NewReplyListener) {
		this.matrixRoom.off(ThreadEvent.NewReply, newReplyListener);
	}

	/**
	 * Passes listener to client.
	 * @param updateReplyListener Method to perform on ThreadEvent.Update
	 */
	public listenToThreadUpdate(updateReplyListener: UpdateReplyListener) {
		this.matrixRoom.on(ThreadEvent.Update, updateReplyListener);
	}

	public stopListeningToThreadUpdate(updateReplyListener: UpdateReplyListener) {
		this.matrixRoom.off(ThreadEvent.Update, updateReplyListener);
	}

	public getThread(eventId: string | undefined): TRoomThread | undefined {
		if (eventId) {
			let thread = this.matrixRoom.getThread(eventId);
			if (thread) {
				return new TRoomThread(thread);
			}
		}
		return undefined;
	}

	public getOrCreateThread(eventId: string | undefined): TRoomThread | undefined {
		if (eventId) {
			let thread = this.getThread(eventId);
			if (thread) {
				return thread;
			} else {
				let createdThread = this.matrixRoom.createThread(eventId, this.findEventById(eventId), undefined, true);
				if (createdThread) {
					return new TRoomThread(createdThread);
				}
			}
		}
		return undefined;
	}

	public async getCurrentThreadEvents(): Promise<TimelineEvent[]> {
		return (await this.currentThread?.thread?.getEvents(this.pubhubsStore.client as MatrixClient)) ?? [];
	}

	public setCurrentThreadLength(newValue: number) {
		if (this.currentThread) {
			this.currentThread.threadLength = newValue;
		}
	}

	public getCurrentThreadLength() {
		return this.currentThread?.threadLength ?? 0;
	}

	public getCurrentThreadId(): string | undefined {
		return this.currentThread?.threadId;
	}

	public getCurrentThread(): TRoomThread | undefined {
		return this.currentThread?.thread;
	}

	public setCurrentThreadId(threadId: string | undefined): boolean {
		this.currentThread = undefined;
		if (threadId) {
			this.currentThread = {
				threadId: threadId,
				rootEvent: this.findEventById(threadId),
				thread: this.getOrCreateThread(threadId),
				threadLength: this.getThread(threadId)?.length ?? 1,
			};
			return true;
		}

		return false;
	}

	public deleteThreadMessage(event: TMessageEvent<TMessageEventContent>, threadRootId: string | undefined) {
		this.deleteMessage(event, undefined, threadRootId);
	}

	public getRoomAvatarMxcUrl(): string | null {
		return this.matrixRoom.getMxcAvatarUrl();
	}

	public getRoomMembers(): number {
		return this.matrixRoom.getMembers().length;
	}

	// #endregion
}
