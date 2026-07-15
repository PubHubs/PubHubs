/**
 * Layout root scroll helpers.
 */
const SCROLL_DURATION = 150;
let animationFrameId: number | null = null;

/**
 * The layout root scrolls smoothly and snaps mandatorily (see App.vue), and both of those act on
 * every scrollLeft this animation writes: the browser re-animates towards each intermediate value,
 * and resolves it to the nearest snap point, which for the first frames is still the one being left
 * behind. That drags the scroll back to where it started, halfway through. So while driving the
 * scroll ourselves, switch both off, and hand them back once we land on the target.
 */
const smoothScrollTo = (element: HTMLElement, targetLeft: number) => {
	if (animationFrameId !== null) {
		cancelAnimationFrame(animationFrameId);
	}
	element.style.scrollBehavior = 'auto';
	element.style.scrollSnapType = 'none';

	const startLeft = element.scrollLeft;
	const distance = targetLeft - startLeft;
	const startTime = performance.now();

	const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

	const animateScroll = (currentTime: number) => {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / SCROLL_DURATION, 1);
		const easedProgress = easeOutCubic(progress);

		element.scrollLeft = startLeft + distance * easedProgress;

		if (progress < 1) {
			animationFrameId = requestAnimationFrame(animateScroll);
		} else {
			animationFrameId = null;
			// Back to the stylesheet's smooth scrolling and snapping, from the snap point we landed on
			element.style.scrollBehavior = '';
			element.style.scrollSnapType = '';
		}
	};

	animationFrameId = requestAnimationFrame(animateScroll);
};
const useRootScroll = () => {
	const scrollToStart = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, 0);
		}
	};

	const scrollToEnd = () => {
		const layoutRoot = document.getElementById('layout-root');
		if (layoutRoot) {
			smoothScrollTo(layoutRoot, layoutRoot.scrollWidth - layoutRoot.clientWidth);
		}
	};

	return {
		scrollToStart,
		scrollToEnd,
	};
};

export default useRootScroll;
