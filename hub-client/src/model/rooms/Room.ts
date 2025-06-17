import { usePubHubs } from '@/logic/core/pubhubsStore';
import { LOGGER } from '@/logic/foundation/Logger';
import { SMI } from '@/logic/foundation/StatusMessage';
import { RoomTimelineWindow } from '@/model/timeline/RoomTimelineWindow';
import { Direction, EventTimeline, EventTimelineSet, MatrixClient, MatrixEvent, Room as MatrixRoom, NotificationCountType, RoomMember as MatrixRoomMember, MsgType, EventType, ThreadEvent, Thread } from 'matrix-js-sdk';
import { CachedReceipt, WrappedReceipt } from 'matrix-js-sdk/lib/@types/read_receipts';
import { TBaseEvent } from '../events/TBaseEvent';
import { TRoomMember } from './TRoomMember';
import TRoomThread from '../thread/RoomThread';
import RoomMember from './RoomMember';
import { TMessageEvent, TMessageEventContent } from '../events/TMessageEvent';
import { useMatrixFiles } from '@/logic/composables/useMatrixFiles';

enum RoomType {
	SECURED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
	PH_MESSAGES_GROUP = 'ph.messages.group',
	PH_MESSAGE_ADMIN_CONTACT = 'ph.messages.admin.contact',
}

const BotName = {
	NOTICE: 'notices',
	SYSTEM: 'system_bot',
};

type RoomThread = {
	threadId: string;
	rootEvent: MatrixEvent | undefined;
	thread: TRoomThread | undefined;
	threadLength: number;
};

type NewReplyListener = (thread: Thread, threadEvent: MatrixEvent) => void;
type UpdateReplyListener = (thread: Thread) => void;

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
	public currentEventId: string | undefined;

	// timelinewindow of currently shown events
	private timelineWindow: RoomTimelineWindow;

	// Keep track of first visible message on screen with eventId and its timestamp.
	// This is used for observing (or detecting) first and last visible message on viewport.
	private firstVisibleTimeStamp: number;
	private firstVisibleEventId: string;

	private lastVisibleTimeStamp: number;
	private lastVisibleEventId: string;

	private pubhubsStore;
	private matrixFiles = useMatrixFiles();

	private roomMembers: Map<string, RoomMember> = new Map();

	logger = LOGGER;

	constructor(matrixRoom: MatrixRoom) {
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

		this.pubhubsStore = usePubHubs();
		this.matrixFiles = useMatrixFiles();

		this.timelineWindow = new RoomTimelineWindow(this.matrixRoom);
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

	public isSecuredRoom(): boolean {
		return this.getType() === RoomType.SECURED;
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

	public setCurrentEventId(eventId: string | undefined) {
		this.currentEventId = eventId;
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

	public getCurrentEventId() {
		return this.currentEventId;
	}

	public resetFirstVisibleEvent() {
		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;
	}

	public getPowerLevel(user_id: string): number {
		const member = this.matrixRoom.getMember(user_id);
		if (member) {
			return member?.powerLevel;
		}
		// Doesn't have power level.
		return -1;
	}

	public getType(): string | undefined {
		return this.matrixRoom.getType();
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

	// #region members

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
		let roomMemberIds = [] as Array<string>;
		const roomMembers = this.matrixRoom.getMembersWithMembership('join');
		roomMemberIds = roomMembers.map((item) => item.userId);
		// filter out (old) notice_users
		roomMemberIds = roomMemberIds.filter((id) => {
			return id.substring(0, 13) !== '@notices_user';
		});
		roomMemberIds.sort();
		return roomMemberIds;
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
		return this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.some((roomEvent) => roomEvent.getType() === EventType.RoomMessage);
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

		const threadIdToDelete = isThreadRoot ? event.event_id : threadId;
		this.pubhubsStore.deleteMessage(this.matrixRoom.roomId, event.event_id, threadIdToDelete);
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
		return this.matrixRoom.getLiveTimeline().getEvents();
	}

	public getLiveTimelineNewestEvent(): Partial<TBaseEvent> | undefined {
		return this.matrixRoom.getLiveTimeline().getEvents().at(-1)?.event;
	}

	public getRelatedLiveTimeEvents(eventId: string): MatrixEvent[] {
		// TODO: use the matrix-js-sdk filter options if possible
		const events = this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.filter((event) => {
				return event.event.content?.['m.relates_to']?.event_id === eventId;
			});
		return events;
	}

	public getLivetimelineLength(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().length;
	}

	// #endregion

	// #region TimelineWindow

	// The TimelineWindow that controls the visible part of the timeline
	// this is filtered to show only messages and gets updated by a watch on the liveTimeline

	// initiate and load to newest message by creating a filtered timelineset
	public async loadInitialEvents() {
		this.matrixRoom = this.pubhubsStore.getRoom(this.matrixRoom.roomId)!; // sync matrixRoom to current state
		await this.timelineWindow.initTimelineWindow(this.matrixRoom, this.pubhubsStore.client as MatrixClient);
	}

	public getTimeline(): MatrixEvent[] {
		LOGGER.trace(SMI.ROOM, `Room gettimeline `, {
			getTimeline: this.timelineWindow?.getTimeline(),
		});
		return this.timelineWindow?.getTimeline();
	}

	public async loadToEvent(eventId: string | undefined) {
		await this.timelineWindow?.loadToEvent(eventId);
	}

	public findEventById(eventId: string): MatrixEvent | undefined {
		return this.timelineWindow?.findEventById(eventId);
	}

	public async paginate(direction: Direction) {
		await this.timelineWindow.paginate(direction);
	}

	public isOldestMessageLoaded(): boolean {
		return this.timelineWindow.isOldestMessageLoaded();
	}

	public isNewestMessageLoaded(): boolean {
		return this.timelineWindow?.isNewestMessageLoaded();
	}

	public isVisibleEvent(event: Partial<TBaseEvent>): boolean {
		return this.timelineWindow.isVisibleEvent(event);
	}

	public getTimelineOldestMessageEventId(): string | undefined {
		const timeline = this.getTimeline();
		return timeline?.find((event: MatrixEvent) => event.getType() === EventType.RoomMessage)?.getId();
	}

	/**
	 *
	 * @returns The newest message event id in the default timeline
	 */
	public getNewestMessageEventId(): string | undefined {
		return this.getTimeline()
			?.slice()
			.reverse()
			?.find((event: MatrixEvent) => event.getType() === EventType.RoomMessage)
			?.getId();
	}

	public getUserPowerLevel(userId: string): number {
		const timeline = this.matrixRoom.getLiveTimeline();
		if (timeline !== undefined) {
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
		return this.timelineWindow.getRedactedEventIds().includes(eventId);
	}

	public addToRedactedEventIds(eventId: string): void {
		this.timelineWindow.getRedactedEventIds().push(eventId);
	}

	public removeRedactedEventId(eventId: string): void {
		const index = this.timelineWindow.getRedactedEventIds().indexOf(eventId);
		this.timelineWindow.getRedactedEventIds().splice(index, 1);
	}

	// #endregion

	// #region Threads

	/**
	 * Threads only get created after an event is added to a threadroot event,
	 * here we make sure the created thread is in our model
	 */
	public AssureThread() {
		if (this.currentThread?.threadId && !this.currentThread?.thread) {
			this.currentThread.thread = this.getThread(this.currentThread.threadId);
		}
	}

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
			if (!thread) {
				thread = this.matrixRoom.createThread(eventId, this.findEventById(eventId), undefined, true);
			}
			if (thread) {
				return new TRoomThread(thread);
			}
		}
		return undefined;
	}

	public async getCurrentThreadEvents(): Promise<MatrixEvent[]> {
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
		if (this.matrixRoom.client.supportsThreads() && threadId) {
			this.currentThread = {
				threadId: threadId,
				rootEvent: this.findEventById(threadId),
				thread: this.getThread(threadId),
				threadLength: this.getThread(threadId)?.getLength() ?? 0,
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
