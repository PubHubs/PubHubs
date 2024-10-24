import { usePubHubs } from '@/core/pubhubsStore';
import { LOGGER } from '@/dev/Logger';
import { SMI } from '@/dev/StatusMessage';
import { RoomTimelineWindow } from '@/model/timeline/RoomTimelineWindow';
import { Direction, EventTimeline, EventTimelineSet, MatrixClient, MatrixEvent, Room as MatrixRoom, NotificationCountType } from 'matrix-js-sdk';
import { CachedReceipt, ReceiptType, WrappedReceipt } from 'matrix-js-sdk/lib/@types/read_receipts';
import { TBaseEvent } from '../events/TBaseEvent';
import { TRoomMember } from './TRoomMember';

enum RoomType {
	SECURED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
}

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
	private matrixRoom: MatrixRoom;

	// keep track of 'removed' rooms that are not synced yet.
	private hidden: boolean;

	public numUnreadMessages: number;

	// timelinewindow of currently shown events
	private timelineWindow: RoomTimelineWindow;

	// Keep track of first visible message on screen with eventId and its timestamp.
	// This is used for observing (or detecting) first and last visible message on viewport.
	private firstVisibleTimeStamp: number;
	private firstVisibleEventId: string;

	private lastVisibleTimeStamp: number;
	private lastVisibleEventId: string;

	private pubhubsStore;

	public test: number;

	logger = LOGGER;

	constructor(matrixRoom: MatrixRoom) {
		LOGGER.log(SMI.ROOM_TRACE, `Roomclass Constructor `, { roomId: matrixRoom.roomId });

		this.matrixRoom = matrixRoom;
		this.hidden = false;
		this.numUnreadMessages = 0;

		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;

		this.lastVisibleEventId = '';
		this.lastVisibleTimeStamp = 0;

		this.pubhubsStore = usePubHubs();

		this.test = 0;
		LOGGER.log(SMI.ROOM_TRACE, `TEST ${this.test}`);

		this.timelineWindow = new RoomTimelineWindow(this.matrixRoom, this.pubhubsStore.client as MatrixClient);
	}

	public isPrivateRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGES_DM;
	}

	public isSecuredRoom(): boolean {
		return this.getType() === RoomType.SECURED;
	}

	// #region getters and setters
	get roomId(): string {
		return this.matrixRoom.roomId;
	}

	get name(): string {
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

	public getFirstVisibleEventId(): string {
		return this.firstVisibleEventId;
	}

	public getFirstVisibleTimeStamp(): number {
		return this.firstVisibleTimeStamp;
	}

	public getLastVisibleEventId(): string {
		console.log(`lastVisibleEventId, incrementing test from ${this.test} to ${this.test + 1}`);
		this.test++;
		return this.lastVisibleEventId;
	}

	public getLastVisibleTimeStamp(): number {
		return this.lastVisibleTimeStamp;
	}

	public resetFirstVisibleEvent() {
		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;
	}

	public getPowerLevel(user_id: string): Number | boolean {
		const member = this.matrixRoom.getMember(user_id);
		if (member) {
			return member?.powerLevel;
		}
		return false;
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
	public getMember(userId: string) {
		return this.matrixRoom.getMember(userId);
	}

	/**
	 * Gets all joined members of the room except the current user or any bots.
	 */
	public getOtherJoinedMembers(): TRoomMember[] {
		return this.getOtherMembers(this.matrixRoom.getMembersWithMembership('join'));
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
			.some((roomEvent) => roomEvent.getType() === 'm.room.message');
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

	// #endregion

	//#region notification functions

	public resetUnreadMessages() {
		this.numUnreadMessages = 0;
	}

	public getReceiptForEvent(event: MatrixEvent): CachedReceipt[] {
		return this.matrixRoom.getReceiptsForEvent(event);
	}

	public getReadReceiptForUserId(userId: string, ignoreSynthesized: boolean, receiptType: ReceiptType): WrappedReceipt | null {
		return this.matrixRoom.getReadReceiptForUserId(userId, ignoreSynthesized, receiptType);
	}

	public getEventReadUpTo(userId: string, ignoreSynthesized?: boolean) {
		return this.matrixRoom.getEventReadUpTo(userId, ignoreSynthesized);
	}

	public getRoomUnreadNotificationCount(type?: NotificationCountType): number {
		return this.matrixRoom.getRoomUnreadNotificationCount(type);
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

	public getLivetimelineLength(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().length;
	}

	// #endregion

	// #region TimelineWindow

	// The TimelineWindow that controls the visible part of the timeline
	// this is filtered to show only messages and gets updated by a watch on the liveTimeline

	// initiate and load to newest message by creating a filtered timelineset
	public async loadInitialEvents() {
		await this.timelineWindow.initTimelineWindow(this.matrixRoom);
	}

	public getTimeline(): MatrixEvent[] {
		LOGGER.log(SMI.ROOM_TRACE, `Room gettimeline `, { getTimeline: this.timelineWindow?.getTimeline() });
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
		return timeline?.find((event: MatrixEvent) => event.getType() === 'm.room.message')?.getId();
	}

	public getTimelineNewestMessageEventId(): string | undefined {
		const timeline = this.getTimeline();
		return timeline
			?.slice()
			.reverse()
			?.find((event: MatrixEvent) => event.getType() === 'm.room.message')
			?.getId();
	}

	// #endregion
}
