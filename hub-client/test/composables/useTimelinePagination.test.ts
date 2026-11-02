// Packages
import { mount } from '@vue/test-utils';
import { describe, expect, test, vi } from 'vitest';
import { defineComponent, h, ref, watch } from 'vue';

// Composables
import { useTimelinePagination } from '@hub-client/composables/useTimelinePagination';

// Models
import type Room from '@hub-client/models/rooms/Room';

const CONTAINER_TOP = 0;
const CONTAINER_HEIGHT = 600;

const rect = (top: number, height: number) => ({ top, bottom: top + height, height }) as DOMRect;

/**
 * A column-reverse timeline (scrollTop 0 is the newest message, scrolled up is negative) holding one visible
 * message, used as scroll anchor. Like RoomTimeline, the DOM only re-renders when the timeline version changes;
 * that re-render moves the message by `anchorShift` pixels, like the browser does when older messages get added.
 * `duringFetch` runs while the network request is pending, e.g. to simulate the user scrolling.
 */
function setup(scrollTop: number, anchorShift: number, duringFetch?: (container: HTMLElement) => void) {
	const container = document.createElement('div');
	container.getBoundingClientRect = () => rect(CONTAINER_TOP, CONTAINER_HEIGHT);

	let scrollTopValue = scrollTop;
	const scrollTopWrites: number[] = [];
	Object.defineProperty(container, 'scrollTop', {
		get: () => scrollTopValue,
		set: (value: number) => {
			scrollTopWrites.push(value);
			scrollTopValue = value;
		},
	});

	let anchorTop = 100;
	const anchor = document.createElement('div');
	anchor.dataset.eventId = '$anchor';
	anchor.getBoundingClientRect = () => rect(anchorTop, 50);
	container.appendChild(anchor);

	let version = 0;
	const room = {
		getTimelineVersion: () => version,
		isOldestMessageLoaded: () => false,
		isNewestMessageLoaded: () => true,
		getTimelineOldestMessageId: () => '$oldest',
		paginate: vi.fn(async () => {
			duringFetch?.(container);
			version++;
		}),
	} as unknown as Room;

	let pagination!: ReturnType<typeof useTimelinePagination>;
	mount(
		defineComponent({
			setup() {
				pagination = useTimelinePagination(ref(container), room);
				watch(pagination.timelineVersion, () => {
					anchorTop += anchorShift;
				});
				return () => h('div');
			},
		}),
	);

	return { container, pagination, room, scrollTopWrites };
}

describe('useTimelinePagination.loadPrevious', () => {
	test('keeps the user at the newest message when older messages load', async () => {
		const { container, pagination, room } = setup(-20, 400);

		await pagination.loadPrevious();

		expect(room.paginate).toHaveBeenCalled();
		expect(container.scrollTop).toBe(0);
	});

	test('keeps the anchor message in place when scrolled up', async () => {
		const { container, pagination } = setup(-1000, 200);

		await pagination.loadPrevious();

		expect(container.scrollTop).toBe(-800);
	});

	test('does not snap back to the newest message when the user scrolls up during the fetch', async () => {
		const { container, pagination } = setup(-20, 400, (cont) => {
			cont.scrollTop = -1000;
		});

		await pagination.loadPrevious();

		expect(container.scrollTop).toBe(-600);
	});

	test('does not touch scrollTop when the anchor did not move, so a running smooth scroll is not cancelled', async () => {
		const { pagination, scrollTopWrites } = setup(-1000, 0);

		await pagination.loadPrevious();

		expect(scrollTopWrites).toEqual([]);
	});
});
