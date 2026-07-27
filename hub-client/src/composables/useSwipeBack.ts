// Packages
import { onMounted, onUnmounted } from 'vue';

// The finger has to travel this far horizontally, and stay this much more horizontal than vertical,
// before a drag counts as a back swipe rather than a scroll through the timeline.
const MIN_DISTANCE_PX = 60;
const HORIZONTAL_DOMINANCE = 1.5;

// How much wider than its box an element's content must be before it counts as scrollable sideways.
// A vertical scroller reports an overflow-x of 'auto' as well (setting overflow-y alone computes the
// other axis from 'visible' to 'auto'), so the width is all that tells the two apart, and it can be
// off by a fraction of a pixel from rounding.
const SCROLLABLE_SLACK_PX = 2;

/**
 * A swipe to the right is the gesture form of the back arrow: it runs the same action.
 *
 * The touch happens over the hub iframe, so only the hub sees it; the global client cannot detect
 * this gesture itself. It is the counterpart of MessageType.BackState, which tells the global client
 * to stop its own horizontal scroll from swallowing the swipe while the hub has something to close.
 */
export function useSwipeBack(onSwipeBack: () => void, isEnabled: () => boolean) {
	let startX = 0;
	let startY = 0;
	let tracking = false;

	function onTouchStart(event: TouchEvent) {
		tracking = false;

		// With nothing to go back to, the swipe is not ours: it scrolls the hub out of view, which the
		// global client allows precisely then. Note that these listeners are passive either way, so
		// they never block a scroll themselves, whatever this returns.
		if (!isEnabled()) return;

		// A second finger means a pinch or a scroll, never a back swipe
		if (event.touches.length !== 1) return;

		// A drag that starts on something scrollable sideways (an emoji row, a wide code block) is
		// scrolling that thing, and going back instead would make it impossible to reach its far end.
		if (startsInHorizontalScroller(event.target)) return;

		startX = event.touches[0].clientX;
		startY = event.touches[0].clientY;
		tracking = true;
	}

	function startsInHorizontalScroller(target: EventTarget | null): boolean {
		let element = target instanceof Element ? target : null;
		while (element) {
			if (element.scrollWidth - element.clientWidth > SCROLLABLE_SLACK_PX) {
				const overflowX = getComputedStyle(element).overflowX;
				if (overflowX === 'auto' || overflowX === 'scroll') return true;
			}
			element = element.parentElement;
		}
		return false;
	}

	function onTouchEnd(event: TouchEvent) {
		if (!tracking) return;
		tracking = false;
		if (!isEnabled()) return;

		const touch = event.changedTouches[0];
		if (!touch) return;

		const deltaX = touch.clientX - startX;
		const deltaY = touch.clientY - startY;
		if (deltaX < MIN_DISTANCE_PX) return;
		if (Math.abs(deltaX) < Math.abs(deltaY) * HORIZONTAL_DOMINANCE) return;

		onSwipeBack();
	}

	onMounted(() => {
		window.addEventListener('touchstart', onTouchStart, { passive: true });
		window.addEventListener('touchend', onTouchEnd, { passive: true });
	});

	onUnmounted(() => {
		window.removeEventListener('touchstart', onTouchStart);
		window.removeEventListener('touchend', onTouchEnd);
	});
}
