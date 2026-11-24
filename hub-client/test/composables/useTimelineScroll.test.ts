// Packages
import { mount } from '@vue/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

// Composables
import { getNewTimelineEvents, useTimelineScroll } from '@hub-client/composables/useTimelineScroll';

// Models
import type { TimelineEvent } from '@hub-client/models/events/TimelineEvent';
import type Room from '@hub-client/models/rooms/Room';

const CURRENT_USER = '@me:hub';
const OTHER_USER = '@other:hub';

// In the column-reverse timeline scrollTop 0 is the newest message, scrolling up makes it negative
function createContainer(scrollTop: number) {
	const container = document.createElement('div');
	let value = scrollTop;
	Object.defineProperty(container, 'scrollTop', {
		get: () => value,
		set: (v: number) => {
			value = v;
		},
	});
	container.scrollTo = vi.fn();
	return container;
}

function setup(scrollTop: number) {
	const container = createContainer(scrollTop);
	let scroll!: ReturnType<typeof useTimelineScroll>;
	mount(
		defineComponent({
			setup() {
				scroll = useTimelineScroll(ref(container), {} as Room, CURRENT_USER);
				return () => h('div');
			},
		}),
	);
	return { container, scroll };
}

async function flushRender() {
	await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useTimelineScroll.handleNewMessage', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	test('keeps the newest message in view when a message from another user arrives while at the bottom', async () => {
		const { container, scroll } = setup(0);

		// Content pushes the view slightly up before the new message renders
		container.scrollTop = -40;
		scroll.handleNewMessage('$new', OTHER_USER);
		await flushRender();

		expect(container.scrollTop).toBe(0);
		expect(scroll.isAtNewest.value).toBe(true);
		expect(scroll.newMessageCount.value).toBe(0);
	});

	test('jumps to the newest message for own messages, even when scrolled up', async () => {
		const { container, scroll } = setup(-1000);

		scroll.handleNewMessage('$own', CURRENT_USER);
		await flushRender();

		expect(container.scrollTop).toBe(0);
		expect(scroll.newMessageCount.value).toBe(0);
	});

	test('counts messages from others without scrolling when scrolled up', async () => {
		const { container, scroll } = setup(-1000);

		scroll.handleNewMessage('$a', OTHER_USER);
		scroll.handleNewMessage('$b', OTHER_USER);
		await flushRender();

		expect(container.scrollTop).toBe(-1000);
		expect(scroll.newMessageCount.value).toBe(2);
		expect(scroll.showNewMessagesButton.value).toBe(true);
	});
});

describe('getNewTimelineEvents', () => {
	const event = (eventId: string) => ({ matrixEvent: { event: { event_id: eventId } } }) as TimelineEvent;
	const ids = (events: TimelineEvent[]) => events.map((item) => item.matrixEvent.event.event_id);

	test('returns the events after the last seen one', () => {
		const timeline = ['$1', '$2', '$3', '$4'].map(event);

		expect(ids(getNewTimelineEvents(timeline, '$2', 2, false))).toEqual(['$3', '$4']);
	});

	test('ignores older events added in front while a live message arrives during backward pagination', () => {
		// Before: [$3, $4]. Pagination adds $1, $2 in front while $5 arrives
		const timeline = ['$1', '$2', '$3', '$4', '$5'].map(event);

		expect(ids(getNewTimelineEvents(timeline, '$4', 2, true))).toEqual(['$5']);
	});

	test('returns nothing when only older events were added', () => {
		const timeline = ['$1', '$2', '$3', '$4'].map(event);

		expect(getNewTimelineEvents(timeline, '$4', 2, true)).toEqual([]);
	});

	test('falls back to the length difference when the last seen event is gone', () => {
		// e.g. the local echo ~1 was replaced by its real id
		const timeline = ['$1', '$own', '$2'].map(event);

		expect(ids(getNewTimelineEvents(timeline, '~1', 2, false))).toEqual(['$2']);
		expect(ids(getNewTimelineEvents(timeline, undefined, 2, false))).toEqual(['$2']);
	});

	test('does not guess from the length difference while older events load or on the first load', () => {
		const timeline = ['$1', '$2', '$3'].map(event);

		expect(getNewTimelineEvents(timeline, '~1', 2, true)).toEqual([]);
		expect(getNewTimelineEvents(timeline, undefined, 0, false)).toEqual([]);
	});
});
