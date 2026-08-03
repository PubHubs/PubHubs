// Packages
import { createTestingPinia } from '@pinia/testing';
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';

// Components
import MessageVideoCall from '@hub-client/components/rooms/MessageVideoCall.vue';
import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';

// Logic
import { setUpi18n } from '@hub-client/i18n';
import { PubHubsMgType } from '@hub-client/logic/core/events';

// Models
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import type { Room } from '@hub-client/models/rooms/Room';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

const ROOM_ID = '!videocall:example.org';
const EVENT_ID = '$videocallstart:example.org';

// The bubble lazily renders its body: content appears only once an IntersectionObserver reports
// the message as visible. jsdom has no IntersectionObserver, so stub one that reports visibility
// immediately - otherwise nothing inside `v-if="hasBeenVisible"` is ever rendered.
vi.stubGlobal(
	'IntersectionObserver',
	class {
		private callback: (entries: { isIntersecting: boolean }[]) => void;

		constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
			this.callback = callback;
		}

		observe() {
			this.callback([{ isIntersecting: true }]);
		}

		unobserve() {}
		disconnect() {}
	},
);

/**
 * RoomMessageBubble accepts three prop shapes and unwraps them in its `event` computed.
 * A TimelineEvent keeps the real event at `.matrixEvent.event`, so handing the wrapper
 * straight to a child leaves that child without an event_id - which made MessageVideoCall
 * treat every incoming call as an already-ended one.
 *
 * The real constructor does unrelated work (threads, event handlers), so build the wrapper
 * from the prototype: only `instanceof` and `.matrixEvent.event` matter here.
 */
function makeTimelineEvent(): TimelineEvent {
	const rawEvent = {
		event_id: EVENT_ID,
		room_id: ROOM_ID,
		sender: '@caller:example.org',
		origin_server_ts: 1700000000000,
		type: 'm.room.message',
		content: {
			msgtype: PubHubsMgType.VideoCall,
			body: 'VideoCall Started',
			timestamp: 1700000000000,
		},
	};

	return Object.assign(Object.create(TimelineEvent.prototype), {
		matrixEvent: {
			event: rawEvent,
			getContent: () => rawEvent.content,
			getId: () => EVENT_ID,
		},
		roomId: ROOM_ID,
		_isDeleted: false,
	}) as TimelineEvent;
}

/** Only the room methods the bubble's template calls while rendering. */
function makeRoom(): Room {
	return {
		roomId: ROOM_ID,
		getHideState: () => false,
		getPowerLevel: () => 0,
		getType: () => 'ph.messages.default',
		isDirectMessageRoom: () => false,
		isForumRoom: () => false,
		setCurrentThreadId: () => undefined,
		// read via useRooms().currentRoom by the expert-verification composable
		getVerifications: () => [],
	} as unknown as Room;
}

function mountBubble() {
	const i18n = setUpi18n();
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		// The bubble reads the user store, whose `user` getter asserts a client is present.
		initialState: {
			user: { userId: '@me:example.org', client: { getUser: () => undefined } },
		},
	});

	const room = makeRoom();

	// Composables used by the bubble reach for useRooms().currentRoom rather than the room prop.
	const rooms = useRooms(pinia);
	rooms.rooms[ROOM_ID] = room as unknown as ReturnType<typeof useRooms>['rooms'][string];
	rooms.currentRoomId = ROOM_ID;

	return mount(RoomMessageBubble, {
		shallow: true,
		props: {
			event: makeTimelineEvent(),
			room,
		},
		global: { plugins: [pinia, i18n] },
	});
}

describe('RoomMessageBubble video call wiring', () => {
	test('hands MessageVideoCall an unwrapped event carrying event_id', async () => {
		const wrapper = mountBubble();
		// hasBeenVisible flips during onMounted, so the body renders on the following tick.
		await flushPromises();

		const videoCall = wrapper.findComponent(MessageVideoCall);
		expect(videoCall.exists()).toBe(true);

		// Without event_id, MessageVideoCall cannot tell whether this is the newest call
		// message, so it labels the call ended and hides the join button.
		expect((videoCall.props('event') as { event_id?: string }).event_id).toBe(EVENT_ID);
	});
});
