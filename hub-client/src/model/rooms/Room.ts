import { CachedReceipt, ReceiptType, WrappedReceipt } from 'matrix-js-sdk/lib/@types/read_receipts';
import { EventTimeline, MatrixEvent, Room as MatrixRoom, EventTimelineSet, NotificationCountType } from 'matrix-js-sdk';
import { useUser } from '@/store/user';
import { useRooms } from '@/store/rooms';
import { TBaseEvent } from '../events/TBaseEvent';
import { TRoomMember } from './TRoomMember';
// import { useI18n } from 'vue-i18n';

enum RoomType {
	SECURED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
}

const BotName = {
	NOTICE: 'notices',
	SYSTEM: 'system_bot',
};

/** event filters */
const visibleEventTypes = ['m.room.message'];
const invisibleMessageTypes = ['m.notice']; // looking in event.content.msgtype
const isMessageEvent = (event: MatrixEvent) => event.event.type === 'm.room.message';
const isVisibleEvent = (event: MatrixEvent) => {
	if (!visibleEventTypes.includes(event.event.type as string)) return false;
	if (event.event.content?.msgtype) {
		if (invisibleMessageTypes.includes(event.event.content?.msgtype)) return false;
	}
	return true;
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
	public oldestEventIsLoaded: boolean;

	// Keep track of first visible message on screen with eventId and its timestamp.
	// This is used for observing (or detecting) first and last visible message on viewport.
	private firstVisibleTimeStamp: number;
	private firstVisibleEventId: string;

	private lastVisibleTimeStamp: number;
	private lastVisibleEventId: string;

	private userStore;
	private roomsStore;

	constructor(matrixRoom: MatrixRoom) {
		this.matrixRoom = matrixRoom;
		this.hidden = false;
		this.numUnreadMessages = 0;
		this.oldestEventIsLoaded = false;

		this.firstVisibleEventId = '';
		this.firstVisibleTimeStamp = 0;

		this.lastVisibleEventId = '';
		this.lastVisibleTimeStamp = 0;

		this.userStore = useUser();
		this.roomsStore = useRooms();
	}

	//#region getters and setters
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

	//#endregion

	//#region members
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
	//#endregion

	//#region events
	public hasEvents(): boolean {
		return this.matrixRoom.getLiveTimeline().getEvents().length > 0;
	}

	public hasMessages(): boolean {
		return this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.some((roomEvent) => roomEvent.getType() === 'm.room.message');
	}

	public findEventById(eventId: string): MatrixEvent | undefined {
		return this.matrixRoom.findEventById(eventId);
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

	public getTimelineSets(): EventTimelineSet[] {
		return this.matrixRoom.getTimelineSets();
	}

	public getTimelineForEvent(eventId: string): EventTimeline | null {
		return this.matrixRoom.getTimelineForEvent(eventId);
	}

	public timelineGetEvents(): MatrixEvent[] {
		return this.matrixRoom.getLiveTimeline().getEvents();
	}

	public timelineGetNewestEvent(): Partial<TBaseEvent> | undefined {
		return this.matrixRoom.getLiveTimeline().getEvents().at(-1)?.event;
	}

	public timelineGetLength(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().length;
	}

	public timelineGetNumMessageEvents(): number {
		return this.matrixRoom.getLiveTimeline().getEvents().filter(isMessageEvent).length;
	}

	/**
	 * Checks whether the timeline contains any events sent by the user.
	 * @param userId
	 * @param since If specified, the index in the timeline array to start checking.
	 */
	public timelineContainsUserSentEvents(userId: string, since?: number): boolean {
		const events = this.matrixRoom.getLiveTimeline().getEvents().slice(since);
		return events.some((event) => event.getSender() === userId);
	}

	public timelineGetOldestMessageEventId(): string | undefined {
		return this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.find((event) => event.getType() === 'm.room.message')
			?.getId();
	}

	public timelineGetNewestMessageEventId(): string | undefined {
		// we have to check all timelines to get the newest event
		const timelineSets = this.getTimelineSets();
		let newestEventId: string | undefined = undefined;
		let eventDate: Date | null = null;
		timelineSets.forEach((timelineSet) => {
			timelineSet.getTimelines().forEach((timeline) => {
				timeline.getEvents().forEach((event) => {
					const currentEventDate = event.getDate();
					if (event.getType() === 'm.room.message' && currentEventDate != null) {
						if (!eventDate) {
							eventDate = currentEventDate;
							newestEventId = event.getId();
						}
						if (currentEventDate > eventDate) {
							newestEventId = event.getId();
						}
					}
				});
			});
		});
		return newestEventId;
	}

	//#endregion

	public getVisibleTimeline() {
		const timeline = this.matrixRoom.getLiveTimeline().getEvents().filter(isVisibleEvent);
		return timeline;
	}

	public isPrivateRoom(): boolean {
		return this.getType() === RoomType.PH_MESSAGES_DM;
	}

	public isSecuredRoom(): boolean {
		return this.getType() === RoomType.SECURED;
	}

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
}
