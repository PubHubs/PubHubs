// Packages
import { VotingWidgetType } from '../events/voting/VotingTypes';
import {
	Direction,
	EventTimeline,
	type EventTimelineSet,
	EventType,
	type Filter,
	type GroupCall,
	GroupCallIntent,
	GroupCallType,
	type IStateEvent,
	type MatrixClient,
	MatrixEvent,
	type Room as MatrixRoom,
	type RoomMember as MatrixRoomMember,
	MsgType,
	NotificationCountType,
	ReceiptType,
	type Thread,
} from 'matrix-js-sdk';
import { type CachedReceipt, type WrappedReceipt } from 'matrix-js-sdk/lib/@types/read_receipts';
import { type MatrixRTCSession } from 'matrix-js-sdk/lib/matrixrtc/MatrixRTCSession';
import { type MSC3575RoomData as SlidingSyncRoomData } from 'matrix-js-sdk/lib/sliding-sync';

// Composables
import { useMatrixFiles } from '@hub-client/composables/useMatrixFiles';

import { api_synapse } from '@hub-client/logic/core/api';
import { PubHubsMgType } from '@hub-client/logic/core/events';
// Logic
import { createLogger } from '@hub-client/logic/logging/Logger';

// Models
import { MatrixEventType, Redaction, type RelatedEventsOptions, RelationType } from '@hub-client/models/constants';
import { type TMessageEvent, type TMessageEventContent } from '@hub-client/models/events/TMessageEvent';
import { type TTimeoutStateEvent } from '@hub-client/models/events/TTimeoutEvent';
import { type TYellowCardStateEvent } from '@hub-client/models/events/TYellowCardEvent';
import { type TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import { isVisibleEvent } from '@hub-client/models/events/isVisibleEvent';
import { type TCurrentEvent } from '@hub-client/models/events/types';
import RoomMember, { type RoomMemberStateEvent } from '@hub-client/models/rooms/RoomMember';
import { RoomType, type UnreadState } from '@hub-client/models/rooms/TBaseRoom';
import { type TRoomMember } from '@hub-client/models/rooms/TRoomMember';
import { type StoredUnreadInfo, getStoredUnreadInfo, updateStoredUnreadInfo } from '@hub-client/models/rooms/unreadInfoCache';
import TRoomThread from '@hub-client/models/thread/RoomThread';
import { TimelineManager } from '@hub-client/models/timeline/TimelineManager';

// Stores
import { usePubhubsStore } from '@hub-client/stores/pubhubs';
import { FeatureFlag, useSettings } from '@hub-client/stores/settings';

const logger = createLogger('Room');

type RoomThread = {
	threadId: string;
	rootEvent: MatrixEvent | undefined;
	thread: TRoomThread | undefined;
	threadLength: number;
};

const BotName = {
	NOTICE: 'notices',
	SYSTEM: 'system_bot',
};

/**
 * Our model of a room based on matrix rooms with some added functionality.
 * It uses the matrix-js-sdk's Room class under the hood.
 */
export default class Room {
	public matrixRoom: MatrixRoom;

	// keep track of 'removed' rooms that are not synced yet.
	private hidden: boolean;

	// Threads/Events, public for vue reactivity
	public currentThread: RoomThread | undefined = undefined;
	public currentEvent: TCurrentEvent | undefined = undefined;
	//public threadUpdated: Ref<boolean> = ref(false); // toggle to indicate changed thread to vue components
	public threadUpdated: boolean = false; // toggle to indicate changed thread to vue components

	/** Whether the first sliding sync response has been received for this room's subscription */
	public syncDataReceived: boolean = false;

	// timelinemanager of currently shown events
	private timelineManager: TimelineManager;

	// Keep track of first visible message on screen with eventId and its timestamp.
	// This is used for observing (or detecting) first and last visible message on viewport.
	private firstVisibleTimeStamp: number;
	private firstVisibleEventId: string;
	private lastVisibleTimeStamp: number;
	private lastVisibleEventId: string;

	// Threads need their own tracking of read messages, per threadrootId
	private threadLastVisibleTimeStamp: Record<string, number | undefined> = {};
	private threadLastVisibleEventId: Record<string, string | undefined> = {};

	private roomType: string;

	private pubhubsStore;
	private matrixFiles = useMatrixFiles();

	private roomMembers: Map<string, RoomMember> = new Map();

	/** Used in reactions: Contains all related events for an event. New related event for an event only stores the last event not the history */
	private eventMultipleRelateEvents: MatrixEvent[] = [];

	private stateEvents: IStateEvent[];

	constructor(matrixRoom: MatrixRoom);
	constructor(matrixRoom: MatrixRoom, roomType: string, stateEvents: IStateEvent[]);
	constructor(matrixRoom: MatrixRoom, roomType?: string, stateEvents?: IStateEvent[]) {
		logger.debug(`Roomclass Constructor `, {
			roomId: matrixRoom.roomId,
		});

		this.matrixRoom = matrixRoom;
		this.hidden = false;

		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;

		this.lastVisibleEventId = '';
		this.lastVisibleTimeStamp = 0;

		this.roomType = roomType ?? '';

		// TODO Sliding Sync: Should not simply assign, but look per item if already present and then modify or add
		this.stateEvents = stateEvents ?? [];

		this.pubhubsStore = usePubhubsStore();
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
		return this.getType() === RoomType.PH_MESSAGES_RESTRICTED;
	}

	public isForumRoom(): boolean {
		const settings = useSettings();
		if (!settings.isFeatureEnabled(FeatureFlag.forumRooms)) return false;
		return this.getType() === RoomType.PH_FORUM_ROOM;
	}

	public isDirectMessageRoom(): boolean {
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

	public setLastVisibleTimeStamp(visibleTimeStamp: number, threadRootId: string | undefined = undefined) {
		if (threadRootId) {
			this.threadLastVisibleTimeStamp[threadRootId] = visibleTimeStamp;
		} else {
			this.lastVisibleTimeStamp = visibleTimeStamp;
		}
	}

	public setFirstVisibleEventId(visibleEventId: string) {
		this.firstVisibleEventId = visibleEventId;
	}

	public setLastVisibleEventId(visibleEventId: string, threadRootId: string | undefined = undefined) {
		if (threadRootId) {
			this.threadLastVisibleEventId[threadRootId] = visibleEventId;
		} else {
			this.lastVisibleEventId = visibleEventId;
		}
	}

	public setCurrentEvent(event: TCurrentEvent | undefined) {
		this.currentEvent = event;
	}

	public setStateEvents(stateEvents: IStateEvent[] | undefined) {
		this.stateEvents = stateEvents ?? [];
	}

	public getStateEvents(): IStateEvent[] {
		return this.stateEvents;
	}

	// Merges new state events into stateEvents, keyed by (type, state_key)
	private mergeStateEvents(newEvents: IStateEvent[]) {
		for (const newEvent of newEvents) {
			const existingIndex = this.stateEvents.findIndex((e) => e.type === newEvent.type && e.state_key === newEvent.state_key);
			if (existingIndex >= 0) {
				this.stateEvents[existingIndex] = newEvent;
			} else {
				this.stateEvents.push(newEvent);
			}
		}
	}

	/**
	 * Used within reactions to show only one instance of multiple together with counter
	 */
	public addCurrentEventToRelatedEvent(event: MatrixEvent) {
		if (this.eventMultipleRelateEvents.indexOf(event) === -1) {
			this.eventMultipleRelateEvents.push(event);
		}
	}

	/**
	 *
	 * Used within reactions to show only one instance of multiple together with counter
	 */
	public getCurrentEventRelatedEvents(): MatrixEvent[] {
		return this.eventMultipleRelateEvents;
	}

	public getFirstVisibleEventId(): string {
		return this.firstVisibleEventId;
	}

	public getFirstVisibleTimeStamp(): number {
		return this.firstVisibleTimeStamp;
	}

	public getLastVisibleEventId(threadRootId: string | undefined = undefined): string {
		return threadRootId ? (this.threadLastVisibleEventId[threadRootId] ?? '') : this.lastVisibleEventId;
	}

	public getLastVisibleTimeStamp(threadRootId: string | undefined = undefined): number {
		return threadRootId ? (this.threadLastVisibleTimeStamp[threadRootId] ?? 0) : this.lastVisibleTimeStamp;
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

	public getHideState(eventId: string) {
		return this.timelineManager.getHideState(eventId);
	}

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
		return this.stateEvents.filter((item) => item.content.membership === 'join').map((item) => item.sender);
	}

	public getStateJoinedMembers(): RoomMemberStateEvent[] {
		return this.stateEvents.filter((item) => item.content.membership === 'join') as RoomMemberStateEvent[];
	}

	public getStateMemberPowerLevel(userId: string | null): number {
		if (!userId) return 0;
		const event = this.stateEvents.filter((event) => event.type === EventType.RoomPowerLevels).find((event) => event.content.users);

		if (!event) return 0;
		return event.content.users[userId] ?? event.content.users_default;
	}

	public getStatePowerLevel() {
		const event = this.stateEvents.filter((event) => event.type === EventType.RoomPowerLevels).find((event) => event.content.users);
		if (!event) return null;
		return event;
	}

	public getStateTimeout(): TTimeoutStateEvent | undefined {
		return this.stateEvents.find((e) => e.type === MatrixEventType.Timeout && e.state_key === '') as TTimeoutStateEvent | undefined;
	}

	public getStateYellowCard(): TYellowCardStateEvent | undefined {
		return this.stateEvents.find((e) => e.type === MatrixEventType.YellowCard && e.state_key === '') as TYellowCardStateEvent | undefined;
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

	public getOtherInviteMembers(): TRoomMember[] {
		return this.getOtherMembers(this.matrixRoom.getMembersWithMembership('invite'));
	}

	/**
	 * Gets all joined and invited members of the room except the current user or any bots.
	 */
	public getOtherJoinedAndInvitedMembers(): TRoomMember[] {
		return this.getOtherMembers(
			Array.from(new Set([...this.matrixRoom.getMembersWithMembership('join'), ...this.matrixRoom.getMembersWithMembership('invite')])),
		);
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

	public getRoomStewards(): Array<TRoomMember> {
		return this.getMembersIds()
			.map((member) => this.getMember(member))
			.filter((roomMember) => roomMember !== null && roomMember.powerLevel === 50) as unknown as Array<TRoomMember>;
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
		const reactEventId = this.getReactionEvent(event.event_id) ? this.getReactionEvent(event.event_id).pop()?.getId() : undefined;

		// FIXME: Typing error
		const threadIdToDelete = isThreadRoot ? event.event_id : threadId;
		this.pubhubsStore.deleteMessage(this.matrixRoom.roomId, event.event_id, threadIdToDelete, reactEventId);
	}

	// #endregion

	// #region notification functions

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

	public unreadState(): UnreadState {
		return Room.unreadState(this.matrixRoom, this);
	}

	/**
	 * Determines the unread state of a room by extracting four parameters
	 * from the timeline and delegating to computeUnreadState. When a project
	 * Room is provided, its TimelineManager is consulted for visible events
	 * that may pre-date the sliding sync window (e.g. when invisible events
	 * have saturated the live timeline).
	 */
	static unreadState(matrixRoom: MatrixRoom, projectRoom?: Room): UnreadState {
		const userId = matrixRoom.client.getUserId();
		if (!userId) return 'read';

		const roomId = matrixRoom.roomId;
		// matrix-js-sdk appends to the live timeline in arrival order, not by ts.
		// When a room is first sent via a list (timeline_limit=1) and later
		// expanded via a subscription (timeline_limit=50), the latest event sits
		// at index 0 with older events appended after it. Sort a copy so the
		// rest of this function can rely on chronological order.
		const events = [...matrixRoom.getLiveTimeline().getEvents()].sort((a, b) => a.getTs() - b.getTs());
		const stored = getStoredUnreadInfo(roomId);
		const receiptTs = matrixRoom.getReadReceiptForUserId(userId, false, ReceiptType.ReadPrivate)?.data.ts ?? 0;

		if (events.length === 0) {
			return computeUnreadState(receiptTs, undefined, undefined, stored);
		}

		const params = extractTimelineParams(events, userId, receiptTs);
		const { effectiveReceiptTs, timelineStartTs } = params;
		let { lastVisibleTs } = params;

		// Merge with TimelineManager: it holds visible events sorted ascending
		// by ts (invariant; see TimelineManager._timelineEvents) and may include
		// older messages paginated via /messages that aren't in the sliding
		// sync window. Live's visible events should be a subset of TM's, so
		// TM's last visible should never be older than live's — warn if it is.
		if (projectRoom) {
			const tmEvents = projectRoom.getLiveTimelineEvents();
			if (tmEvents.length > 0) {
				const tmLastVisibleTs = tmEvents[tmEvents.length - 1].getTs();
				if (lastVisibleTs !== undefined && tmLastVisibleTs < lastVisibleTs) {
					logger.warn('TimelineManager missing visible event present in live timeline', {
						roomId,
						liveLastVisibleTs: lastVisibleTs,
						tmLastVisibleTs,
					});
				}
				lastVisibleTs = lastVisibleTs === undefined ? tmLastVisibleTs : Math.max(lastVisibleTs, tmLastVisibleTs);
			}
		}

		const state = computeUnreadState(effectiveReceiptTs, lastVisibleTs, timelineStartTs, stored);
		updateStoredUnreadInfo(roomId, {
			lastVisibleTs: lastVisibleTs ?? 0,
			lastReadAllTs: state === 'read' ? events[events.length - 1].getTs() : undefined,
		});
		return state;
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

	public getLiveTimelineNewestEvent(): MatrixEvent | undefined {
		return this.timelineManager
			.getEvents()
			.map((x) => x.matrixEvent)
			.at(-1);
		//return this.matrixRoom.getLiveTimeline().getEvents().at(-1)?.event;
	}

	/**Select the latest voting event per user and voting option -> schedulers
	 * or per user -> polls
	 * @param votingWidgetType Poll or Scheduler?
	 * @param eventId
	 * @returns array of latest voting events per user and voting option (scheduler) or per user (poll)
	 */
	public filterRoomWidgetRelatedEvents(votingWidgetType: string, eventId: string): MatrixEvent[] {
		const relatedTimeleineEvents = this.timelineManager.getRelatedEvents(eventId);
		if (!relatedTimeleineEvents) {
			return [];
		}

		const relatedEvents = relatedTimeleineEvents.map((x) => x.matrixEvent);

		if (votingWidgetType === VotingWidgetType.SCHEDULER) {
			// Scheduler: return all latest events per user per option
			const relatedEventsByOption = Object.values(
				relatedEvents.reduce(
					(acc, event) => {
						const optionId = event.getContent()?.optionId;
						const userId = event.getSender();

						if (!acc[optionId]) {
							acc[optionId] = [];
						}

						const existingIndex = acc[optionId].findIndex((event: MatrixEvent) => event.getSender() === userId);
						if (existingIndex === -1) {
							acc[optionId].push(event);
						} else {
							if ((acc[optionId][existingIndex].getTs() ?? 0) < (event.getTs() ?? 0)) {
								acc[optionId][existingIndex] = event;
							}
						}
						return acc;
					},
					{} as Record<string, MatrixEvent[]>,
				),
			).flat();
			return relatedEventsByOption;
		} else {
			//Poll: return all latest events per user
			const latestEventsPerUser = Object.values(
				relatedEvents.reduce(
					(acc, event) => {
						const userId = event.getSender();
						if (userId && (!acc[userId] || (acc[userId].getTs() ?? 0) < (event.getTs() ?? 0))) {
							acc[userId] = event;
						}
						return acc;
					},
					{} as Record<string, MatrixEvent>,
				),
			);
			return latestEventsPerUser;
		}
	}

	public getRelatedEvents(eventId: string): TimelineEvent[] {
		return this.timelineManager.getRelatedEvents(eventId);
	}

	public getRelatedEventsByType(eventId: string, options: RelatedEventsOptions = {}): TimelineEvent[] {
		return this.timelineManager.getRelatedEventsByType(eventId, options);
	}

	public fetchRelatedEvents(eventIds: string[]) {
		return this.timelineManager.fetchRelatedEvents(eventIds);
	}

	public getReactEventsFromTimeLine(): MatrixEvent[] {
		return this.getLiveTimelineEvents().filter((event) => event.getType() === EventType.Reaction);
	}

	public getLivetimelineLength(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().length;
	}

	// #endregion

	// #region TimelineManager

	/**
	 * Initialization room timeline: subscribes to sliding sync and loads initial messages
	 */
	public async initTimeline() {
		this.syncDataReceived = false;
		this.timelineManager.initRoomTimeline(this.matrixRoom.roomId);

		// Load initial timeline if empty
		if (this.timelineManager.getEvents().length === 0) {
			await this.loadInitialTimeline();
		}
	}

	/**
	 * Initialization room library
	 */
	public async initFileLibrary() {
		return this.timelineManager.initFileLibrary();
	}

	public loadFromSlidingSync(roomData: SlidingSyncRoomData) {
		this.syncDataReceived = true;
		if (roomData.required_state && roomData.required_state.length > 0) {
			this.mergeStateEvents(roomData.required_state);
		}

		if (!roomData.timeline || roomData.timeline.length === 0) return;
		const eventList = roomData.timeline.map((event) => {
			return new MatrixEvent(event);
		});
		// BEGIN THREADS
		// Threads are kept on room-level, so all events regarding the current thread need to be filtered and handled first.

		// Handle thread redactions, for now only the DeletedFromThread events
		const redactions = eventList.filter(
			(event) => event.getContent()?.[Redaction.Redacts] && event.getContent()?.[Redaction.Reason] === Redaction.DeletedFromThread,
		);
		if (redactions.length > 0) {
			this.currentThread?.thread?.addRedactions(redactions);
		}
		// Handle thread events, only when they are from the currentthread (otherwise they will be fetched on opening the thread)
		const currentThreadEvents = eventList.filter(
			(event) =>
				event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread &&
				this.currentThread?.threadId === event.getContent()[RelationType.RelatesTo]?.[RelationType.EventId],
		);
		if (currentThreadEvents.length > 0 && this.currentThread?.thread) {
			this.currentThread.thread.addEvents(currentThreadEvents);
		}

		// set toggle to force vue component updates when something in the threads has changed, will also set current event for thread
		if (currentThreadEvents.length > 0 || redactions.length > 0) {
			this.threadUpdated = !this.threadUpdated;
		}

		// Events in threads that are NOT in the currentThread only need to update the specific counters
		// This is done by notifying them the length has changed
		const otherThreadEvents = eventList.filter(
			(event) =>
				event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] === RelationType.Thread &&
				this.currentThread?.threadId !== event.getContent()[RelationType.RelatesTo]?.[RelationType.EventId],
		);
		if (otherThreadEvents.length > 0) {
			// make a set of all the rootIds of the otherThreadEvents
			const otherThreadEventIds = new Set(otherThreadEvents.map((x) => x.getContent()[RelationType.RelatesTo]?.[RelationType.EventId]));

			const currentEvents = this.timelineManager.getEvents();

			// get the visible other threads by checking on the id
			const visibleOtherThreads = currentEvents.filter((x) => otherThreadEventIds.has(x.matrixEvent.getId()));
			visibleOtherThreads.forEach((event) => {
				const eventId = event.matrixEvent.getId();
				if (eventId) {
					event.thread.setMatrixThread(this.getOrCreateMatrixThread(eventId));
				}
				event.thread.getEvents(this.matrixRoom.client).then((_x) => event.thread.notifyLengthChange());
			});
		}

		// END THREADS

		const nonCurrentThreadEvents = eventList.filter((event) => event.getContent()[RelationType.RelatesTo]?.[RelationType.RelType] !== RelationType.Thread);

		this.timelineManager.loadFromSlidingSync(nonCurrentThreadEvents).then((scrollToEventId) => {
			if (scrollToEventId) {
				this.setCurrentEvent({ eventId: scrollToEventId });
			}
		});
	}

	public getTimeline(): TimelineEvent[] {
		return this.timelineManager.getEvents();
	}

	/**
	 * Returns timeline events sorted chronologically (oldest first)
	 */
	public getChronologicalTimeline(): TimelineEvent[] {
		return this.timelineManager.getChronologicalTimeline();
	}

	/**
	 * Returns the timeline version counter
	 */
	public getTimelineVersion(): number {
		return this.timelineManager.getTimelineVersion();
	}

	public getLibraryTimeline(): TimelineEvent[] {
		return this.timelineManager.getLibraryEvents();
	}

	/**
	 *
	 * @returns The newest message event id in the default timeline
	 */
	public getTimelineNewestMessageEventId(): string | undefined {
		return this.timelineManager?.getTimelineNewestMessageId();
	}

	public getMessagesFilter(): Filter {
		return this.timelineManager?.getMessagesFilter();
	}

	// The TimelineManager that controls the visible part of the timeline
	// this is filtered to show only messages and gets updated by sliding sync or pagination

	public async loadToEvent(currentEvent: TCurrentEvent) {
		await this.timelineManager?.loadToEvent(currentEvent);
	}

	public findTimelinEventById(eventId: string): TimelineEvent | undefined {
		return this.timelineManager?.findTimelineEventById(eventId);
	}

	public findEventById(eventId: string | undefined): MatrixEvent | undefined {
		return this.timelineManager?.findEventById(eventId);
	}

	public async paginate(direction: Direction, limit: number, fromEventId: string) {
		await this.timelineManager.paginate(direction, limit, fromEventId);
	}

	/**
	 * Loads initial timeline messages when the timeline is empty.
	 * Fetches the most recent message and loads the timeline around it.
	 */
	public async loadInitialTimeline(): Promise<void> {
		if (this.timelineManager.getEvents().length > 0) {
			return; // Timeline already has events
		}

		const messagesResponse = await this.matrixRoom.client.createMessagesRequest(
			this.roomId,
			null,
			1,
			Direction.Backward,
			this.timelineManager.getMessagesFilter(),
		);

		const lastEventId = messagesResponse.chunk[0]?.event_id;
		if (lastEventId) {
			await this.loadToEvent({ eventId: lastEventId });
		}
	}

	public isOldestMessageLoaded(): boolean {
		return this.timelineManager.isOldestMessageLoaded();
	}

	public isNewestMessageLoaded(): boolean {
		return this.timelineManager?.isNewestMessageLoaded();
	}

	public isVisibleEvent(event: MatrixEvent): boolean {
		return this.timelineManager.isVisibleEvent(event.event);
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

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
	public inRedactedMessageIds(eventId: string): boolean {
		return this.timelineManager.getRedactedEventIds().includes(eventId);
	}

	// TODO update this so redactedEventIds is not used anymore. Now only reactions use these for when deleting reactions
	public addToRedactedEventIds(eventId: string): void {
		this.timelineManager.getRedactedEventIds().push(eventId);
	}

	public isDeletedEvent(eventId: string) {
		return this.timelineManager.IsDeletedEvent(eventId);
	}

	// #endregion

	// #region Threads

	public getMatrixThread(eventId: string): Thread | undefined {
		return this.matrixRoom.getThread(eventId) ?? undefined;
	}

	public getMatrixThreadLastEvent(eventId: string): MatrixEvent | undefined | null {
		const thread = this.getMatrixThread(eventId);
		if (!thread) return undefined;
		return thread.replyToEvent;
	}

	public getMatrixThreadLastEventTimestamp(eventId: string): number | undefined {
		const lastEvent = this.getMatrixThreadLastEvent(eventId);
		return lastEvent?.getTs();
	}

	public createMatrixThread(eventId: string): Thread {
		return this.matrixRoom.createThread(eventId, this.findEventById(eventId), undefined, true);
	}

	public getOrCreateMatrixThread(eventId: string) {
		return this.getMatrixThread(eventId) ?? this.createMatrixThread(eventId);
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
			const matrixThread = this.getOrCreateMatrixThread(threadId);
			const thread = new TRoomThread(matrixThread);
			this.currentThread = {
				threadId: threadId,
				rootEvent: this.findEventById(threadId) ?? this.matrixRoom.findEventById(threadId),
				thread: thread,
				threadLength: thread.length || 1,
			};
			return true;
		}

		return false;
	}

	public deleteThreadMessage(event: TMessageEvent<TMessageEventContent>, threadRootId: string | undefined) {
		this.deleteMessage(event, undefined, threadRootId);
	}

	// get the authorized url of the room-avatar
	public async getRoomAvatarAuthorizedUrl(): Promise<string | undefined> {
		const mxcUrl = this.matrixRoom.getMxcAvatarUrl();
		if (mxcUrl) {
			return await this.matrixFiles.getAuthorizedMediaUrl(mxcUrl);
		}
		return undefined;
	}

	public getRoomMembers(): number {
		return this.matrixRoom.getMembers().length;
	}

	// #endregion

	// #region VideoCall

	public startMatrixRTC() {
		this.matrixRoom.client.matrixRTC.start();
	}

	public getMatrixRTCSessions(): MatrixRTCSession {
		return this.matrixRoom.client.matrixRTC.getRoomSession(this.matrixRoom);
	}

	//TODO maybe move to pubhubsstore
	public async getLiveKitTokenResponse(): Promise<[string, string]> {
		const response = await api_synapse.apiGET(api_synapse.apiURLS.videoCall + '?room_id=' + this.roomId);
		// @ts-expect-error -- API response is loosely typed and returns token/livekit_url keys at runtime
		return [response.token, response.livekit_url];
	}

	public async createGroupCall(): Promise<GroupCall> {
		await api_synapse.apiPOST(api_synapse.apiURLS.videoCall + '?room_id=' + this.roomId, {});
		return await this.matrixRoom.client.createGroupCall(this.roomId, GroupCallType.Video, false, GroupCallIntent.Room, true);
	}

	public getGroupCall(): GroupCall | null {
		return this.matrixRoom.client.getGroupCallForRoom(this.roomId);
	}

	public isOngoingCall() {
		const groupCall = this.matrixRoom.client.getGroupCallForRoom(this.roomId);
		if (groupCall) return true;
		return false;
	}

	public getLastVideoCallTimeLineEvent(): MatrixEvent | undefined {
		const timeline = this.getLiveTimelineEvents();

		const lastVideoCallMessage = timeline.findLast((e) => e.event.content?.msgtype === PubHubsMgType.VideoCall);
		if (!lastVideoCallMessage || !lastVideoCallMessage.event.event_id) {
			return undefined;
		}

		return lastVideoCallMessage;
	}

	//#endregion
}

// #region Unread state helpers

/**
 * Extract timeline parameters for computeUnreadState from a non-empty event list.
 * Own visible events advance effectiveReceiptTs (sending a message is an implicit receipt).
 * Reaching m.room.create sets timelineStartTs to 0 (no gap — timeline covers the full room).
 */
function extractTimelineParams(
	events: MatrixEvent[],
	userId: string,
	receiptTs: number,
): { effectiveReceiptTs: number; lastVisibleTs: number | undefined; timelineStartTs: number } {
	let effectiveReceiptTs = receiptTs;
	let lastVisibleTs: number | undefined;
	let timelineStartTs = events[0].getTs();
	let foundLastVisible = false;
	let foundOwnReceipt = false;

	for (let i = events.length - 1; i >= 0; i--) {
		if (events[i].getType() === EventType.RoomCreate) {
			timelineStartTs = 0;
			break;
		}
		if (!isVisibleEvent(events[i].event, userId)) continue;
		if (!foundLastVisible) {
			lastVisibleTs = events[i].getTs();
			foundLastVisible = true;
		}
		if (!foundOwnReceipt && events[i].getSender() === userId) {
			effectiveReceiptTs = Math.max(effectiveReceiptTs, events[i].getTs());
			foundOwnReceipt = true;
		}
		if (foundLastVisible && foundOwnReceipt) break;
	}

	return { effectiveReceiptTs, lastVisibleTs, timelineStartTs };
}

/**
 * Pure decision function: determines unread state from five parameters.
 *
 * The function is a monotone (order-preserving) map from the product of
 * five partially ordered sets to {unread < unknown < read}:
 *
 *   receiptTs           ∈ (ℝ≥0, ≤)          — order-preserving (↑ → more read)
 *   lastReadAllTs       ∈ (ℝ>0 ∪ {⊥}, ≤)   — order-preserving (↑ → more read); ⊥ incomparable
 *   lastVisibleTs       ∈ (ℝ>0 ∪ {⊥}, ≥)   — order-reversing  (↑ → less read); ⊥ incomparable
 *   timelineStartTs     ∈ (ℝ>0 ∪ {⊥}, ≥)   — order-reversing  (↑ → less read); ⊥ incomparable
 *   storedLastVisibleTs ∈ (ℝ>0 ∪ {⊥}, ≥)   — order-reversing  (↑ → less read); ⊥ incomparable
 *
 * The decision models the existence of a hypothetical unread visible event
 * at timestamp Ts > receiptTs:
 *   - unread:  evidence that Ts exists
 *   - read:    proof that Ts cannot exist
 *   - unknown: neither
 *
 * lastReadAllTs is a cached proof that the room was read at a specific
 * point. It may account for information not captured by receiptTs alone
 * (e.g. own messages acting as implicit receipts). When it falls within
 * the timeline window and no visible event appeared after it, the room
 * is still read — even if non-visible events (e.g. display name changes)
 * advanced the timeline.
 */
export function computeUnreadState(
	receiptTs: number,
	lastVisibleTs: number | undefined,
	timelineStartTs: number | undefined,
	stored: StoredUnreadInfo | undefined,
): UnreadState {
	// Cache: lastReadAllTs covers the timeline window, and no visible event
	// appeared after it (lastVisibleTs is either absent or older).
	if (stored?.lastReadAllTs !== undefined && timelineStartTs !== undefined && stored.lastReadAllTs >= timelineStartTs) {
		if (lastVisibleTs === undefined || lastVisibleTs <= stored.lastReadAllTs) return 'read';
	}

	// Direct evidence: a visible event exists in the timeline.
	if (lastVisibleTs !== undefined) {
		return lastVisibleTs > receiptTs ? 'unread' : 'read';
	}

	// No visible event in timeline. Could an unread event hide in a blind spot?
	if (timelineStartTs !== undefined) {
		if (timelineStartTs <= receiptTs) return 'read';
		if (stored && stored.lastVisibleTs > receiptTs) return 'unread';
		return 'unknown';
	}

	// Empty timeline — no direct evidence at all.
	if (stored?.lastReadAllTs !== undefined) return 'read';
	if (stored && stored.lastVisibleTs > receiptTs) return 'unread';
	if (stored && stored.lastVisibleTs > 0 && stored.lastVisibleTs <= receiptTs) return 'read';
	return 'unknown';
}

// #endregion
