import { EventTimeline, MatrixEvent, Room as MatrixRoom, ReceiptType } from 'matrix-js-sdk';
import { TEvent } from '../events/TEvent';
import { usePlugins } from '@/store/plugins';
import { useUser } from '@/store/user';
import { useRooms } from '@/store/rooms';
import { TBaseEvent } from '../events/TBaseEvent';
import { TRoomMember } from './TRoomMember';

enum RoomType {
	SECURED = 'ph.messages.restricted',
	PH_MESSAGES_DM = 'ph.messages.dm',
}

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

	private userStore;
	private roomsStore;

	constructor(matrixRoom: MatrixRoom) {
		this.matrixRoom = matrixRoom;
		this.hidden = false;
		this.numUnreadMessages = 0;
		this.oldestEventIsLoaded = false;

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
		if (timeline != undefined) {
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

	public getPrivateRoomMembers(): TRoomMember[] {
		const currentUserId = this.matrixRoom.client.getUserId();
		const members = this.matrixRoom.getMembers();
		const foundMe = members.findIndex((item) => item.userId == currentUserId);
		if (foundMe >= 0) {
			members.splice(foundMe, 1);
		}
		return members;
	}

	public getMemberNames(): Array<string> {
		return this.matrixRoom.getMembers().map((item) => item.name);
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

	public getOtherMembersIds(user_id: string): Array<string> {
		const roomMemberIds = this.getMembersIds();
		const foundIndex = roomMemberIds.findIndex((member_id) => member_id == user_id);
		if (foundIndex >= 0) {
			return roomMemberIds.toSpliced(foundIndex, 1);
		}
		return roomMemberIds;
	}

	public hasExactMembersInName(memberIds: Array<string>): boolean {
		const roomMemberIds = this.getMembersIdsFromName();
		return JSON.stringify(memberIds.toSorted()) === JSON.stringify(roomMemberIds);
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
		const isMessageEvent = (event: MatrixEvent) => event.event.type === 'm.room.message';
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
			.find((event) => event.getType() == 'm.room.message')
			?.getId();
	}

	//#endregion

	public addPluginsToTimeline() {
		const roomType = this.matrixRoom.getType();
		const timeline = this.matrixRoom.getLiveTimeline().getEvents();
		const plugins = usePlugins();
		const len = timeline.length;
		for (let idx = 0; idx < len; idx++) {
			const event = timeline[idx].event as Partial<TEvent>;
			event.plugin = undefined;
			const eventPlugin = plugins.getEventPlugin(event, this.roomId, roomType);
			if (eventPlugin) {
				event.plugin = eventPlugin;
			} else {
				const eventMessagePlugin = plugins.getEventMessagePlugin(event, this.roomId, roomType);
				if (eventMessagePlugin) {
					event.plugin = eventMessagePlugin;
				}
			}
			timeline[idx].event = event as any;
		}
		return timeline;
	}

	public isPrivateRoom(): boolean {
		return this.getType() == RoomType.PH_MESSAGES_DM;
	}

	public isSecuredRoom(): boolean {
		return this.getType() === RoomType.SECURED;
	}

	//#region notification functions

	public resetUnreadMessages() {
		this.numUnreadMessages = 0;
	}

	public getReadReceiptForUserId(userId: string) {
		return this.matrixRoom.getReadReceiptForUserId(userId, false, ReceiptType.Read);
	}

	// This will give the latest timestamp of the receipt i.e., recent read receipt TS.
	private getReceiptForUserId(userId: string) {
		const mEvents = this.matrixRoom
			.getLiveTimeline()
			.getEvents()
			.filter((event) => event.event.type === 'm.receipt' && event.event.sender === userId)
			.map((event) => event.localTimestamp);

		const storedTS = localStorage.getItem('receiptTS');
		const tsData = storedTS ? JSON.parse(storedTS) : null;

		if (tsData && tsData instanceof Array) {
			// Find the timestamp for the specified roomId
			const roomTimestamp = tsData.find((data) => data.roomId === this.roomId)?.timestamp;

			// Return the latest timestamp, considering both local events and stored data
			return roomTimestamp ? Math.max(...mEvents, roomTimestamp) : Math.max(...mEvents);
		}

		return Math.max(...mEvents);
	}

	private getLatestEvents() {
		let localMatrixEvent: MatrixEvent[] = [];

		// Compare the timstamp from last event and check if timestamp of receipt is less than the events of message type.
		// We don't want to mess up the original timeline by
		localMatrixEvent = Object.assign(localMatrixEvent, this.matrixRoom.getLiveTimeline().getEvents());

		// To get the latest timestamp of message - from the bottom to avoid going through all the events.
		// until the latest receipt timestamp.
		return localMatrixEvent.reverse();
	}

	// This method can be useful to make decisions based on last event.
	// For example, who send the message.
	// Last time of an event.
	public getlastEvent() {
		return this.getLatestEvents()[0];
	}

	public unreadMessageCounter(singleEvent: MatrixEvent | undefined): void {
		const receiptTS = this.getReceiptForUserId(this.userStore.user.userId);

		if (singleEvent === undefined) {
			// Always initialize to remove any inaccuracies due to caching before counting unread messages.
			let messageCounter = 0;
			this.resetUnreadMessages();

			// Counting from the latest message.
			const reverseTimeLine = this.getLatestEvents();
			for (const latestEvent of reverseTimeLine) {
				if (receiptTS < latestEvent.localTimestamp && latestEvent.event.sender !== this.userStore.user.userId) {
					if (latestEvent.getType() === 'm.room.message') {
						if (latestEvent.event.content?.['m.mentions'] !== undefined) {
							if (latestEvent.event.content?.['m.mentions'].user_ids !== undefined) {
								if (this.unreadMentionMsgCount(latestEvent)) {
									messageCounter = ++messageCounter;
								}
							}
						} else {
							messageCounter = ++messageCounter;
						}
					}
				} else if (receiptTS > latestEvent.localTimestamp && latestEvent.event.sender !== this.userStore.user.userId) {
					this.numUnreadMessages += messageCounter;
					// Send this to the global client
					this.roomsStore.sendUnreadMessageCounter();
					break;
				}
			}
		} else {
			if (receiptTS < singleEvent.localTimestamp && singleEvent.event.sender !== this.userStore.user.userId) {
				if (singleEvent.event.content?.['m.mentions']?.['user_ids'] !== undefined && singleEvent.event.content['m.mentions']['user_ids'].length > 0) {
					// Only if 'this' user is mentioned then count. If other users are mentioned then don't count.
					if (this.unreadMentionMsgCount(singleEvent)) {
						this.numUnreadMessages += 1;
						this.roomsStore.sendUnreadMessageCounter();
					}
				} else {
					// If there is no mention for this user, but we have a new message, still count.
					this.numUnreadMessages += 1;
					this.roomsStore.sendUnreadMessageCounter();
				}
			}
		}
	}

	private unreadMentionMsgCount(currentMsgEvent: MatrixEvent) {
		const user = useUser();

		let onlyPseudonymInLogUser = '';
		// It is a string so better to convert it to an array of mentions.
		// It could be a single string or an array of strings. Hencce we convert it to an array.
		//@ts-ignore
		const userIdsInMention: string[] = currentMsgEvent.event.content?.['m.mentions'].user_ids.includes(',')
			? //@ts-ignore
				currentMsgEvent.event.content?.['m.mentions'].user_ids.split(',')
			: //@ts-ignore
				[currentMsgEvent.event.content?.['m.mentions'].user_ids];

		const loggedInUserInMention = user.user.displayName!;
		// XXX: Another check for handling display name with pseudonym issue.
		// Sometimes display name when changing doesn't update properly. In the meantime, someone might mention the user.
		if (loggedInUserInMention.startsWith('@')) {
			// We extract only pesudonym. If display name is not returned.
			// XXX: Tightly coupled with pseudonym format.
			onlyPseudonymInLogUser = loggedInUserInMention.substring(1, 7);
		}
		// Only only if you are mentioned!
		for (const element of userIdsInMention) {
			if (element[0] !== undefined) {
				if (loggedInUserInMention === element[0] || element[0].includes(onlyPseudonymInLogUser)) {
					return true;
				}
			}
		}

		return false;
	}

	//#endregion
}
