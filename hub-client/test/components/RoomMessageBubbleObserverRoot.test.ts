// Packages
import { createTestingPinia } from '@pinia/testing';
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';

// Components
import RoomMessageBubble from '@hub-client/components/rooms/RoomMessageBubble.vue';

// Composables
import { timelineScrollRootKey } from '@hub-client/composables/useTimelineScroll';

// Models
import { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import type { Room } from '@hub-client/models/rooms/Room';

// Stores
import { useRooms } from '@hub-client/stores/rooms';

// Logic
import { setUpi18n } from '@hub-client/i18n';

const ROOM_ID = '!observer:example.org';
const EVENT_ID = '$message:example.org';

// Records the options of every IntersectionObserver the bubble creates (jsdom has none)
const observerOptions: (IntersectionObserverInit | undefined)[] = [];
vi.stubGlobal(
	'IntersectionObserver',
	class {
		constructor(_callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
			observerOptions.push(options);
		}

		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

// Built from the prototype like in RoomMessageBubbleVideoCall.test.ts: only `instanceof` and `.matrixEvent.event` matter
function makeTimelineEvent(): TimelineEvent {
	const rawEvent = {
		event_id: EVENT_ID,
		room_id: ROOM_ID,
		sender: '@other:example.org',
		origin_server_ts: 1700000000000,
		type: 'm.room.message',
		content: { msgtype: 'm.text', body: 'Hello' },
	};

	return Object.assign(Object.create(TimelineEvent.prototype), {
		matrixEvent: { event: rawEvent, getContent: () => rawEvent.content, getId: () => EVENT_ID },
		roomId: ROOM_ID,
		_isDeleted: false,
	}) as TimelineEvent;
}

function mountBubble(scrollRoot?: HTMLElement, attachTo?: HTMLElement) {
	const pinia = createTestingPinia({
		createSpy: vi.fn,
		initialState: { user: { userId: '@me:example.org', client: { getUser: () => undefined } } },
	});

	const room = {
		roomId: ROOM_ID,
		getHideState: () => false,
		getPowerLevel: () => 0,
		getType: () => 'ph.messages.default',
		isDirectMessageRoom: () => false,
		isForumRoom: () => false,
		setCurrentThreadId: () => undefined,
		getVerifications: () => [],
	} as unknown as Room;

	const rooms = useRooms(pinia);
	rooms.rooms[ROOM_ID] = room as unknown as ReturnType<typeof useRooms>['rooms'][string];
	rooms.currentRoomId = ROOM_ID;

	return mount(RoomMessageBubble, {
		shallow: true,
		props: { event: makeTimelineEvent(), room },
		attachTo,
		global: {
			plugins: [pinia, setUpi18n()],
			provide: scrollRoot ? { [timelineScrollRootKey as symbol]: ref(scrollRoot) } : {},
		},
	});
}

describe('RoomMessageBubble lazy-render observer', () => {
	beforeEach(() => {
		observerOptions.length = 0;
	});

	test('uses the timeline scroll container as root, so the pre-load margin applies inside it', () => {
		const timeline = document.createElement('div');
		const item = timeline.appendChild(document.createElement('div'));
		document.body.appendChild(timeline);

		const wrapper = mountBubble(timeline, item);
		wrapper.unmount();
		timeline.remove();

		expect(observerOptions).toHaveLength(1);
		expect(observerOptions[0]?.root).toBe(timeline);
		expect(observerOptions[0]?.rootMargin).toBe('500px');
	});

	test('falls back to the viewport when rendered outside the timeline scroll container', () => {
		// Like the delete dialog, which RoomTimeline renders next to its scroll container
		const timeline = document.createElement('div');

		mountBubble(timeline);

		expect(observerOptions).toHaveLength(1);
		expect(observerOptions[0]?.root).toBeNull();
	});

	test('falls back to the viewport outside a timeline', () => {
		mountBubble();

		expect(observerOptions).toHaveLength(1);
		expect(observerOptions[0]?.root).toBeNull();
	});
});
